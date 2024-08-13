// Copyright 2021 The Casdoor Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import React from "react";
import {Button, Card, Checkbox, Col, Input, InputNumber, Row, Select, Switch} from "antd";
import {ClearOutlined, LinkOutlined} from "@ant-design/icons";
import * as ProviderBackend from "./backend/ProviderBackend";
import * as OrganizationBackend from "./backend/OrganizationBackend";
import * as CertBackend from "./backend/CertBackend";
import * as Setting from "./Setting";
import i18next from "i18next";
import {authConfig} from "./auth/Auth";
import * as ProviderEditTestEmail from "./common/TestEmailWidget";
import * as ProviderNotification from "./common/TestNotificationWidget";
import * as ProviderEditTestSms from "./common/TestSmsWidget";
import copy from "copy-to-clipboard";
import {CaptchaPreview} from "./common/CaptchaPreview";
import {CountryCodeSelect} from "./common/select/CountryCodeSelect";
import * as Web3Auth from "./auth/Web3Auth";
import RoleMappingTable from "./table/RoleMappingTable";

const {Option} = Select;
const {TextArea} = Input;

class ProviderEditPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      classes: props,
      providerName: props.match.params.providerName,
      owner: props.organizationName !== undefined ? props.organizationName : props.match.params.organizationName,
      provider: null,
      caCerts: [],
      clientCerts: [],
      organizations: [],
      mode: props.location.mode !== undefined ? props.location.mode : "edit",
    };
  }

  UNSAFE_componentWillMount() {
    this.getOrganizations();
    this.getProvider();
    this.getCerts(this.state.owner);
  }

  getProvider() {
    ProviderBackend.getProvider(this.state.owner, this.state.providerName)
      .then((res) => {
        if (res.data === null) {
          this.props.history.push("/404");
          return;
        }

        if (res.status === "ok") {
          const provider = res.data;
          provider.userMapping = provider.userMapping || {};
          this.setState({
            provider: provider,
          });
          this.getCerts(res.data.owner);
        } else {
          Setting.showMessage("error", res.msg);
        }
      });
  }

  getOrganizations() {
    if (Setting.isAdminUser(this.props.account)) {
      OrganizationBackend.getOrganizations("admin")
        .then((res) => {
          this.setState({
            organizations: res.data || [],
          });
        });
    }
  }

  getCerts(owner) {
    CertBackend.getCerts(owner, -1, -1, "scope", Setting.CertScopeCACert, "", "")
      .then((res) => {
        if (res.status === "ok") {
          this.setState({
            caCerts: res.data || [],
          });
        }
      });
    CertBackend.getCerts(owner, -1, -1, "scope", Setting.CertScopeClientCert, "", "")
      .then((res) => {
        if (res.status === "ok") {
          this.setState({
            clientCerts: res.data || [],
          });
        }
      });
  }

  parseProviderField(key, value) {
    if (["port"].includes(key)) {
      value = Setting.myParseInt(value);
    }
    return value;
  }

  updateProviderField(key, value) {
    value = this.parseProviderField(key, value);

    const provider = this.state.provider;
    if (key === "owner" && provider["owner"] !== value) {
      // the provider change the owner, reset the cert
      provider["cert"] = "";
      this.getCerts(value);
    }
    provider[key] = value;

    if (key === "owner" && value === "admin") {
      provider["enableRoleMapping"] = false;
    }

    this.setState({
      provider: provider,
    });
  }

  updateUserMappingField(key, value) {
    const provider = this.state.provider;
    if (value.length === 0) {
      delete provider.userMapping[key];
    } else {
      if (!Array.isArray(value)) {
        value = [value];
      }
      provider.userMapping[key] = value;
    }
    this.setState({
      provider: provider,
    });
  }

  renderUserMappingInput() {
    return (
      <React.Fragment>
        {Setting.getLabel(i18next.t("general:ID"), i18next.t("general:ID - Tooltip"))} :
        <Input value={this.state.provider.userMapping.id?.length > 0 ? this.state.provider.userMapping.id[0] : null} onChange={e => {
          this.updateUserMappingField("id", e.target.value);
        }} />
        {Setting.getLabel(i18next.t("signup:Username"), i18next.t("provider:Username - Tooltip"))} :
        <Select
          mode="tags"
          style={{width: "100%"}}
          value={this.state.provider.userMapping.username}
          onChange={value => {
            this.updateUserMappingField("username", value);
          }}
        />
        {Setting.getLabel(i18next.t("general:Display name"), i18next.t("provider:Display name - Tooltip"))} :
        <Select
          mode="tags"
          style={{width: "100%"}}
          value={this.state.provider.userMapping.displayName}
          onChange={value => {
            this.updateUserMappingField("displayName", value);
          }}
        />
        {Setting.getLabel(i18next.t("general:Email"), i18next.t("provider:Email - Tooltip"))} :
        <Select
          mode="tags"
          style={{width: "100%"}}
          value={this.state.provider.userMapping.email}
          onChange={value => {
            this.updateUserMappingField("email", value);
          }}
        />
      </React.Fragment>
    );
  }
  getClientIdLabel(provider) {
    switch (provider.category) {
    case "Email":
      return Setting.getLabel(i18next.t("signup:Username"), i18next.t("signup:Username - Tooltip"));
    case "SMS":
      if (provider.type === "Volc Engine SMS" || provider.type === "Amazon SNS" || provider.type === "Baidu Cloud SMS") {
        return Setting.getLabel(i18next.t("provider:Access key"), i18next.t("provider:Access key - Tooltip"));
      } else if (provider.type === "Huawei Cloud SMS") {
        return Setting.getLabel(i18next.t("provider:App key"), i18next.t("provider:App key - Tooltip"));
      } else if (provider.type === "UCloud SMS") {
        return Setting.getLabel(i18next.t("provider:Public key"), i18next.t("provider:Public key - Tooltip"));
      } else if (provider.type === "Msg91 SMS" || provider.type === "Infobip SMS") {
        return Setting.getLabel(i18next.t("provider:Sender Id"), i18next.t("provider:Sender Id - Tooltip"));
      } else {
        return Setting.getLabel(i18next.t("provider:Client ID"), i18next.t("provider:Client ID - Tooltip"));
      }
    case "Captcha":
      if (provider.type === "Aliyun Captcha") {
        return Setting.getLabel(i18next.t("provider:Access key"), i18next.t("provider:Access key - Tooltip"));
      } else {
        return Setting.getLabel(i18next.t("provider:Site key"), i18next.t("provider:Site key - Tooltip"));
      }
    case "Notification":
      if (provider.type === "DingTalk") {
        return Setting.getLabel(i18next.t("provider:Access key"), i18next.t("provider:Access key - Tooltip"));
      } else {
        return Setting.getLabel(i18next.t("provider:Client ID"), i18next.t("provider:Client ID - Tooltip"));
      }
    default:
      return Setting.getLabel(i18next.t("provider:Client ID"), i18next.t("provider:Client ID - Tooltip"));
    }
  }

  getClientSecretLabel(provider) {
    switch (provider.category) {
    case "Email":
      if (provider.type === "Azure ACS") {
        return Setting.getLabel(i18next.t("provider:Secret key"), i18next.t("provider:Secret key - Tooltip"));
      } else {
        return Setting.getLabel(i18next.t("general:Password"), i18next.t("general:Password - Tooltip"));
      }
    case "SMS":
      if (provider.type === "Volc Engine SMS" || provider.type === "Amazon SNS" || provider.type === "Baidu Cloud SMS") {
        return Setting.getLabel(i18next.t("provider:Secret access key"), i18next.t("provider:Secret access key - Tooltip"));
      } else if (provider.type === "Huawei Cloud SMS") {
        return Setting.getLabel(i18next.t("provider:App secret"), i18next.t("provider:AppSecret - Tooltip"));
      } else if (provider.type === "UCloud SMS") {
        return Setting.getLabel(i18next.t("provider:Private Key"), i18next.t("provider:Private Key - Tooltip"));
      } else if (provider.type === "Msg91 SMS") {
        return Setting.getLabel(i18next.t("provider:Auth Key"), i18next.t("provider:Auth Key - Tooltip"));
      } else if (provider.type === "Infobip SMS") {
        return Setting.getLabel(i18next.t("provider:Api Key"), i18next.t("provider:Api Key - Tooltip"));
      } else {
        return Setting.getLabel(i18next.t("provider:Client secret"), i18next.t("provider:Client secret - Tooltip"));
      }
    case "Captcha":
      if (provider.type === "Aliyun Captcha") {
        return Setting.getLabel(i18next.t("provider:Secret access key"), i18next.t("provider:Secret access key - Tooltip"));
      } else {
        return Setting.getLabel(i18next.t("provider:Secret key"), i18next.t("provider:Secret key - Tooltip"));
      }
    case "Notification":
      if (provider.type === "Line" || provider.type === "Telegram" || provider.type === "Bark" || provider.type === "DingTalk" || provider.type === "Discord" || provider.type === "Slack" || provider.type === "Pushover" || provider.type === "Pushbullet") {
        return Setting.getLabel(i18next.t("provider:Secret key"), i18next.t("provider:Secret key - Tooltip"));
      } else if (provider.type === "Lark" || provider.type === "Microsoft Teams") {
        return Setting.getLabel(i18next.t("provider:Endpoint"), i18next.t("provider:Endpoint - Tooltip"));
      } else {
        return Setting.getLabel(i18next.t("provider:Client secret"), i18next.t("provider:Client secret - Tooltip"));
      }
    default:
      return Setting.getLabel(i18next.t("provider:Client secret"), i18next.t("provider:Client secret - Tooltip"));
    }
  }

  getClientId2Label(provider) {
    switch (provider.category) {
    case "Email":
      return Setting.getLabel(i18next.t("provider:From address"), i18next.t("provider:From address - Tooltip"));
    default:
      if (provider.type === "Aliyun Captcha") {
        return Setting.getLabel(i18next.t("provider:Scene"), i18next.t("provider:Scene - Tooltip"));
      } else if (provider.type === "WeChat Pay") {
        return Setting.getLabel(i18next.t("provider:App ID"), i18next.t("provider:App ID - Tooltip"));
      } else {
        return Setting.getLabel(i18next.t("provider:Client ID 2"), i18next.t("provider:Client ID 2 - Tooltip"));
      }
    }
  }

  getClientSecret2Label(provider) {
    switch (provider.category) {
    case "Email":
      return Setting.getLabel(i18next.t("provider:From name"), i18next.t("provider:From name - Tooltip"));
    default:
      if (provider.type === "Aliyun Captcha") {
        return Setting.getLabel(i18next.t("provider:App key"), i18next.t("provider:App key - Tooltip"));
      } else {
        return Setting.getLabel(i18next.t("provider:Client secret 2"), i18next.t("provider:Client secret 2 - Tooltip"));
      }
    }
  }

  getProviderSubTypeOptions(type) {
    if (type === "WeCom" || type === "Infoflow") {
      return (
        [
          {id: "Internal", name: i18next.t("provider:Internal")},
          {id: "Third-party", name: i18next.t("provider:Third-party")},
        ]
      );
    } else if (type === "Aliyun Captcha") {
      return [
        {id: "nc", name: i18next.t("provider:Sliding Validation")},
        {id: "ic", name: i18next.t("provider:Intelligent Validation")},
      ];
    } else {
      return [];
    }
  }

  getAppIdRow(provider) {
    let text = "";
    let tooltip = "";

    if (provider.category === "OAuth") {
      if (provider.type === "WeCom" && provider.subType === "Internal") {
        text = i18next.t("provider:Agent ID");
        tooltip = i18next.t("provider:Agent ID - Tooltip");
      } else if (provider.type === "Infoflow") {
        text = i18next.t("provider:Agent ID");
        tooltip = i18next.t("provider:Agent ID - Tooltip");
      }
    } else if (provider.category === "SMS") {
      if (provider.type === "Twilio SMS" || provider.type === "Azure ACS") {
        text = i18next.t("provider:Sender number");
        tooltip = i18next.t("provider:Sender number - Tooltip");
      } else if (provider.type === "Tencent Cloud SMS") {
        text = i18next.t("provider:App ID");
        tooltip = i18next.t("provider:App ID - Tooltip");
      } else if (provider.type === "Volc Engine SMS") {
        text = i18next.t("provider:SMS account");
        tooltip = i18next.t("provider:SMS account - Tooltip");
      } else if (provider.type === "Huawei Cloud SMS") {
        text = i18next.t("provider:Channel No.");
        tooltip = i18next.t("provider:Channel No. - Tooltip");
      } else if (provider.type === "Amazon SNS") {
        text = i18next.t("provider:Region");
        tooltip = i18next.t("provider:Region - Tooltip");
      } else if (provider.type === "Baidu Cloud SMS") {
        text = i18next.t("provider:Endpoint");
        tooltip = i18next.t("provider:Endpoint - Tooltip");
      } else if (provider.type === "Infobip SMS") {
        text = i18next.t("provider:Base URL");
        tooltip = i18next.t("provider:Base URL - Tooltip");
      } else if (provider.type === "UCloud SMS") {
        text = i18next.t("provider:Project Id");
        tooltip = i18next.t("provider:Project Id - Tooltip");
      }
    } else if (provider.category === "Email") {
      if (provider.type === "SUBMAIL") {
        text = i18next.t("provider:App ID");
        tooltip = i18next.t("provider:App ID - Tooltip");
      }
    } else if (provider.category === "Notification") {
      if (provider.type === "Viber") {
        text = i18next.t("provider:Domain");
        tooltip = i18next.t("provider:Domain - Tooltip");
      } else if (provider.type === "Line" || provider.type === "Matrix" || provider.type === "Rocket Chat") {
        text = i18next.t("provider:App Key");
        tooltip = i18next.t("provider:App Key - Tooltip");
      }
    }

    if (text === "" && tooltip === "") {
      return null;
    } else {
      return (
        <Row style={{marginTop: "20px"}} >
          <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
            {Setting.getLabel(text, tooltip)} :
          </Col>
          <Col span={22} >
            <Input value={provider.appId} onChange={e => {
              this.updateProviderField("appId", e.target.value);
            }} />
          </Col>
        </Row>
      );
    }
  }

  getReceiverRow(provider) {
    let text = "";
    let tooltip = "";

    if (provider.type === "Telegram" || provider.type === "Pushover" || provider.type === "Pushbullet" || provider.type === "Slack" || provider.type === "Discord" || provider.type === "Line" || provider.type === "Twitter" || provider.type === "Reddit" || provider.type === "Rocket Chat" || provider.type === "Viber") {
      text = i18next.t("provider:Chat ID");
      tooltip = i18next.t("provider:Chat ID - Tooltip");
    } else if (provider.type === "Custom HTTP" || provider.type === "Webpush" || provider.type === "Matrix") {
      text = i18next.t("provider:Endpoint");
      tooltip = i18next.t("provider:Endpoint - Tooltip");
    }

    if (text === "" && tooltip === "") {
      return (
        <React.Fragment>
          <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
            {Setting.getLabel("Test Notification", "Test Notification")} :
          </Col>
        </React.Fragment>
      );
    } else {
      return (
        <React.Fragment>
          <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
            {Setting.getLabel(text, tooltip)} :
          </Col>
          <Col span={6} >
            <Input value={provider.receiver} onChange={e => {
              this.updateProviderField("receiver", e.target.value);
            }} />
          </Col>
        </React.Fragment>
      );
    }
  }

  loadSamlConfiguration() {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(this.state.provider.metadata, "text/xml");

    const cert = document.evaluate(
      "string(/*[local-name()='EntityDescriptor']/*[local-name()='IDPSSODescriptor']/*[local-name()='KeyDescriptor']/*[local-name()='KeyInfo']/*[local-name()='X509Data']/*[local-name()='X509Certificate'][1]/text())",
      xmlDoc,
      null,
      XPathResult.ANY_TYPE,
      null
    ).stringValue;

    const endpoint = document.evaluate(
      `string(/*[local-name()='EntityDescriptor']/*[local-name()='IDPSSODescriptor']/*[local-name()='SingleSignOnService' and @Binding='urn:oasis:names:tc:SAML:2.0:bindings:${this.state.provider.endpointType}']/@Location)`,
      xmlDoc,
      null,
      XPathResult.ANY_TYPE,
      null
    ).stringValue;

    const issuerUrl = document.evaluate(
      "string(/*[local-name()='EntityDescriptor']/@entityID)",
      xmlDoc,
      null,
      XPathResult.ANY_TYPE,
      null
    ).stringValue;

    this.updateProviderField("idP", cert);
    this.updateProviderField("endpoint", endpoint);
    this.updateProviderField("issuerUrl", issuerUrl);
  }

  renderProvider() {
    return (
      <Card size="small" title={
        <div>
          {this.state.mode === "add" ? i18next.t("provider:New Provider") : i18next.t("provider:Edit Provider")}&nbsp;&nbsp;&nbsp;&nbsp;
          <Button onClick={() => this.submitProviderEdit(false)}>{i18next.t("general:Save")}</Button>
          <Button style={{marginLeft: "20px"}} type="primary" onClick={() => this.submitProviderEdit(true)}>{i18next.t("general:Save & Exit")}</Button>
          {this.state.mode === "add" ? <Button style={{marginLeft: "20px"}} onClick={() => this.deleteProvider()}>{i18next.t("general:Cancel")}</Button> : null}
        </div>
      } style={(Setting.isMobile()) ? {margin: "5px"} : {}} type="inner">
        <Row style={{marginTop: "10px"}} >
          <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
            {Setting.getLabel(i18next.t("general:Name"), i18next.t("general:Name - Tooltip"))} :
          </Col>
          <Col span={22} >
            <Input value={this.state.provider.name} onChange={e => {
              this.updateProviderField("name", e.target.value);
            }} />
          </Col>
        </Row>
        <Row style={{marginTop: "20px"}} >
          <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
            {Setting.getLabel(i18next.t("general:Display name"), i18next.t("general:Display name - Tooltip"))} :
          </Col>
          <Col span={22} >
            <Input value={this.state.provider.displayName} onChange={e => {
              this.updateProviderField("displayName", e.target.value);
            }} />
          </Col>
        </Row>
        <Row style={{marginTop: "20px"}} >
          <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
            {Setting.getLabel(i18next.t("general:Organization"), i18next.t("general:Organization - Tooltip"))} :
          </Col>
          <Col span={22} >
            <Select virtual={false} style={{width: "100%"}} disabled={!Setting.isAdminUser(this.props.account)} value={this.state.provider.owner} onChange={(value => {this.updateProviderField("owner", value);})}>
              {Setting.isAdminUser(this.props.account) ? <Option key={"admin"} value={"admin"}>{i18next.t("provider:admin (Shared)")}</Option> : null}
              {
                this.state.organizations.map((organization, index) => <Option key={index} value={organization.name}>{organization.name}</Option>)
              }
            </Select>
          </Col>
        </Row>
        <Row style={{marginTop: "20px"}} >
          <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
            {Setting.getLabel(i18next.t("provider:Category"), i18next.t("provider:Category - Tooltip"))} :
          </Col>
          <Col span={22} >
            <Select virtual={false} style={{width: "100%"}} value={this.state.provider.category} onChange={(value => {
              this.updateProviderField("category", value);
              if (value === "OAuth") {
                this.updateProviderField("type", "Google");
              } else if (value === "Email") {
                this.updateProviderField("type", "Default");
                this.updateProviderField("host", "smtp.example.com");
                this.updateProviderField("port", 465);
                this.updateProviderField("disableSsl", false);
                this.updateProviderField("title", "Casgate Verification Code");
                this.updateProviderField("content", "You have requested a verification code at Casgate. Here is your code: %s, please enter in 5 minutes.");
                this.updateProviderField("inviteTitle", "Casgate Invitation Link");
                this.updateProviderField("inviteContent", "Your invitation link: %s.");
                this.updateProviderField("receiver", this.props.account.email);
              } else if (value === "SMS") {
                this.updateProviderField("type", "Twilio SMS");
              } else if (value === "SAML") {
                this.updateProviderField("type", "Keycloak");
                this.updateProviderField("endpointType", "HTTP-POST");
              } else if (value === "Captcha") {
                this.updateProviderField("type", "Default");
              } else if (value === "Web3") {
                this.updateProviderField("type", "MetaMask");
              } else if (value === "Notification") {
                this.updateProviderField("type", "Telegram");
              }
            })}>
              {
                [
                  {id: "Captcha", name: "Captcha"},
                  {id: "Email", name: "Email"},
                  {id: "Notification", name: "Notification"},
                  {id: "OAuth", name: "OAuth"},
                  {id: "SAML", name: "SAML"},
                  {id: "SMS", name: "SMS"},
                  {id: "Web3", name: "Web3"},
                ]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((providerCategory, index) => <Option key={index} value={providerCategory.id}>{providerCategory.name}</Option>)
              }
            </Select>
          </Col>
        </Row>
        <Row style={{marginTop: "20px"}} >
          <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
            {Setting.getLabel(i18next.t("provider:Type"), i18next.t("provider:Type - Tooltip"))} :
          </Col>
          <Col span={22}>
            <Select virtual={false} style={{width: "100%"}} showSearch value={this.state.provider.type} onChange={(value => {
              this.updateProviderField("type", value);
              if (value === "Local File System") {
                this.updateProviderField("domain", Setting.getFullServerUrl());
              } else if (value === "Custom") {
                this.updateProviderField("customAuthUrl", "https://door.casdoor.com/login/oauth/authorize");
                this.updateProviderField("scopes", "openid profile email");
                this.updateProviderField("customTokenUrl", "https://door.casdoor.com/api/login/oauth/access_token");
                this.updateProviderField("customUserInfoUrl", "https://door.casdoor.com/api/userinfo");
              } else if (value === "Custom HTTP") {
                this.updateProviderField("method", "GET");
                this.updateProviderField("title", "");
              }
            })}>
              {
                Setting.getProviderTypeOptions(this.state.provider.category)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((providerType, index) => <Option key={index} value={providerType.id}>
                    <img width={20} height={20} style={{marginBottom: "3px", marginRight: "10px"}} src={Setting.getProviderLogoURL({category: this.state.provider.category, type: providerType.id})} alt={providerType.id} />
                    {providerType.name}
                  </Option>)
              }
            </Select>
          </Col>
        </Row>
        {
          this.state.provider.type !== "WeCom" && this.state.provider.type !== "Infoflow" && this.state.provider.type !== "Aliyun Captcha" ? null : (
            <React.Fragment>
              <Row style={{marginTop: "20px"}} >
                <Col style={{marginTop: "5px"}} span={2}>
                  {Setting.getLabel(i18next.t("provider:Sub type"), i18next.t("provider:Sub type - Tooltip"))} :
                </Col>
                <Col span={22} >
                  <Select virtual={false} style={{width: "100%"}} value={this.state.provider.subType} onChange={value => {
                    this.updateProviderField("subType", value);
                  }}>
                    {
                      this.getProviderSubTypeOptions(this.state.provider.type).map((providerSubType, index) => <Option key={index} value={providerSubType.id}>{providerSubType.name}</Option>)
                    }
                  </Select>
                </Col>
              </Row>
              {
                this.state.provider.type !== "WeCom" ? null : (
                  <Row style={{marginTop: "20px"}} >
                    <Col style={{marginTop: "5px"}} span={2}>
                      {Setting.getLabel(i18next.t("general:Method"), i18next.t("provider:Method - Tooltip"))} :
                    </Col>
                    <Col span={22} >
                      <Select virtual={false} style={{width: "100%"}} value={this.state.provider.method} onChange={value => {
                        this.updateProviderField("method", value);
                      }}>
                        {
                          [
                            {id: "Normal", name: i18next.t("provider:Normal")},
                            {id: "Silent", name: i18next.t("provider:Silent")},
                          ].map((method, index) => <Option key={index} value={method.id}>{method.name}</Option>)
                        }
                      </Select>
                    </Col>
                  </Row>)
              }
            </React.Fragment>
          )
        }
        {
          this.state.provider.type !== "Custom" && this.state.provider.type !== "OpenID" ? null : (
            <React.Fragment>
              {this.state.provider.type !== "Custom" ? (
                // openid
                <Row style={{marginTop: "20px"}} >
                  <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                    {Setting.getLabel(i18next.t("provider:OpenID Configuration URL"), i18next.t("provider:OpenID Configuration URL - Tooltip"))}
                  </Col>
                  <Col span={22} >
                    <Input value={this.state.provider.customConfUrl} onChange={e => {
                      this.updateProviderField("customConfUrl", e.target.value);
                    }} />
                  </Col>
                </Row>
              ) : (
                <React.Fragment>
                  <Row style={{marginTop: "20px"}} >
                    <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                      {Setting.getLabel(i18next.t("provider:Auth URL"), i18next.t("provider:Auth URL - Tooltip"))}
                    </Col>
                    <Col span={22} >
                      <Input value={this.state.provider.customAuthUrl} onChange={e => {
                        this.updateProviderField("customAuthUrl", e.target.value);
                      }} />
                    </Col>
                  </Row>
                  <Row style={{marginTop: "20px"}} >
                    <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                      {Setting.getLabel(i18next.t("provider:Token URL"), i18next.t("provider:Token URL - Tooltip"))}
                    </Col>
                    <Col span={22} >
                      <Input value={this.state.provider.customTokenUrl} onChange={e => {
                        this.updateProviderField("customTokenUrl", e.target.value);
                      }} />
                    </Col>
                  </Row>
                  <Row style={{marginTop: "20px"}} >
                    <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                      {Setting.getLabel(i18next.t("provider:UserInfo URL"), i18next.t("provider:UserInfo URL - Tooltip"))}
                    </Col>
                    <Col span={22} >
                      <Input value={this.state.provider.customUserInfoUrl} onChange={e => {
                        this.updateProviderField("customUserInfoUrl", e.target.value);
                      }} />
                    </Col>
                  </Row>
                </React.Fragment>
              )}
              <Row style={{marginTop: "20px"}} >
                <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                  {Setting.getLabel(i18next.t("provider:Scope"), i18next.t("provider:Scope - Tooltip"))}
                </Col>
                <Col span={22} >
                  <Input value={this.state.provider.scopes} onChange={e => {
                    this.updateProviderField("scopes", e.target.value);
                  }} />
                </Col>
              </Row>
              <Row style={{marginTop: "20px"}} >
                <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                  {Setting.getLabel(i18next.t("cert:CA Certificate"), i18next.t("cert:CA Certificate - Tooltip"))} :
                </Col>
                <Col span={21} >
                  <Select virtual={false} style={{width: "100%"}} value={this.state.provider.cert} onChange={(value => {this.updateProviderField("cert", value);})}>
                    {
                      this.state.caCerts.map((cert, index) => <Option key={index} value={cert.name}>{cert.name}</Option>)
                    }
                  </Select>
                </Col>
                <Col style={{paddingLeft: "5px"}} span={1} >
                  <Button icon={<ClearOutlined />} type="text" onClick={() => {this.updateProviderField("cert", "");}} >
                  </Button>
                </Col>
              </Row>
            </React.Fragment>
          )
        }
        {
          this.state.provider.type === "Custom" || this.state.provider.type === "OpenID" || this.state.provider.type === "GenericSAML" ? (
            <Row style={{marginTop: "20px"}} >
              <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                {Setting.getLabel(i18next.t("general:Favicon"), i18next.t("general:Favicon - Tooltip"))} :
              </Col>
              <Col span={22} >
                <Row style={{marginTop: "20px"}} >
                  <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 1}>
                    {Setting.getLabel(i18next.t("general:URL"), i18next.t("general:URL - Tooltip"))} :
                  </Col>
                  <Col span={23} >
                    <Input prefix={<LinkOutlined />} value={this.state.provider.customLogo} onChange={e => {
                      this.updateProviderField("customLogo", e.target.value);
                    }} />
                  </Col>
                </Row>
                <Row style={{marginTop: "20px"}} >
                  <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 1}>
                    {i18next.t("general:Preview")}:
                  </Col>
                  <Col span={23} >
                    <a target="_blank" rel="noreferrer" href={this.state.provider.customLogo}>
                      <img src={this.state.provider.customLogo} alt={this.state.provider.customLogo} height={90} style={{marginBottom: "20px"}} />
                    </a>
                  </Col>
                </Row>
              </Col>
            </Row>) : null
        }
        {
          (this.state.provider.type === "Custom" || this.state.provider.category === "SAML" || this.state.provider.type === "OpenID") &&
          <React.Fragment>
            <Row style={{marginTop: "20px"}} >
              <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                {Setting.getLabel(i18next.t("provider:User mapping"), i18next.t("provider:User mapping - Tooltip"))} :
              </Col>
              <Col span={22} >
                {this.renderUserMappingInput()}
              </Col>
            </Row>
          </React.Fragment>
        }
        {
          (this.state.provider.category === "OAuth" || this.state.provider.category === "SAML") &&
          <React.Fragment>
            <Row style={{marginTop: "20px"}} >
              <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                {Setting.getLabel(i18next.t("provider:Role mapping"), i18next.t("provider:Role mapping - Tooltip"))} :
              </Col>
              <Col span={22} >
                <Switch disabled={this.state.provider["owner"] === "admin"} checked={this.state.provider.enableRoleMapping} onChange={checked => {
                  this.updateProviderField("enableRoleMapping", checked);
                }} />
              </Col>
            </Row>
            {this.state.provider?.enableRoleMapping &&
              <Row style={{marginTop: "20px"}}>
                <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                  {Setting.getLabel(i18next.t("provider:Role mapping table"), i18next.t("provider:Role mapping table - Tooltip"))} :
                </Col>
                <Col span={22}>
                  <RoleMappingTable
                    title={i18next.t("ldap:Role mapping rules")}
                    table={this.state.provider.roleMappingItems}
                    owner={this.state.provider.owner}
                    attributes={["email", "role"]}
                    onUpdateTable={(value) => {this.updateProviderField("roleMappingItems", value);}}
                  />
                </Col>
              </Row>
            }
          </React.Fragment>
        }
        {
          (this.state.provider.category === "Captcha" && this.state.provider.type === "Default") ||
          (this.state.provider.category === "Web3") ||
          (this.state.provider.category === "Notification" && (this.state.provider.type === "Google Chat" || this.state.provider.type === "Custom HTTP")) ? null : (
              <React.Fragment>
                {
                  (this.state.provider.category === "Email" && this.state.provider.type === "Azure ACS") ||
                  (this.state.provider.category === "Notification" && (this.state.provider.type === "Line" || this.state.provider.type === "Telegram" || this.state.provider.type === "Bark" || this.state.provider.type === "Discord" || this.state.provider.type === "Slack" || this.state.provider.type === "Pushbullet" || this.state.provider.type === "Pushover" || this.state.provider.type === "Lark" || this.state.provider.type === "Microsoft Teams")) ? null : (
                      <Row style={{marginTop: "20px"}} >
                        <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                          {this.getClientIdLabel(this.state.provider)} :
                        </Col>
                        <Col span={22} >
                          <Input value={this.state.provider.clientId} onChange={e => {
                            this.updateProviderField("clientId", e.target.value);
                          }} />
                        </Col>
                      </Row>
                    )
                }
                <Row style={{marginTop: "20px"}} >
                  <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                    {this.getClientSecretLabel(this.state.provider)} :
                  </Col>
                  <Col span={22} >
                    <Input value={this.state.provider.clientSecret} onChange={e => {
                      this.updateProviderField("clientSecret", e.target.value);
                    }} />
                  </Col>
                </Row>
              </React.Fragment>
            )
        }
        {
          this.state.provider.category !== "Email" && this.state.provider.type !== "WeChat" && this.state.provider.type !== "Aliyun Captcha" && this.state.provider.type !== "WeChat Pay" && this.state.provider.type !== "Twitter" && this.state.provider.type !== "Reddit" ? null : (
            <React.Fragment>
              <Row style={{marginTop: "20px"}} >
                <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                  {this.getClientId2Label(this.state.provider)} :
                </Col>
                <Col span={22} >
                  <Input value={this.state.provider.clientId2} onChange={e => {
                    this.updateProviderField("clientId2", e.target.value);
                  }} />
                </Col>
              </Row>
              {
                (this.state.provider.type === "WeChat Pay") || (this.state.provider.category === "Email" && this.state.provider.type === "Azure ACS") ? null : (
                  <Row style={{marginTop: "20px"}} >
                    <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                      {this.getClientSecret2Label(this.state.provider)} :
                    </Col>
                    <Col span={22} >
                      <Input value={this.state.provider.clientSecret2} onChange={e => {
                        this.updateProviderField("clientSecret2", e.target.value);
                      }} />
                    </Col>
                  </Row>
                )
              }
            </React.Fragment>
          )
        }
        {
          this.state.provider.type !== "WeChat" ? null : (
            <Row style={{marginTop: "20px"}} >
              <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                {Setting.getLabel(i18next.t("provider:Enable QR code"), i18next.t("provider:Enable QR code - Tooltip"))} :
              </Col>
              <Col span={1} >
                <Switch checked={this.state.provider.disableSsl} onChange={checked => {
                  this.updateProviderField("disableSsl", checked);
                }} />
              </Col>
            </Row>
          )
        }
        {
          this.state.provider.type !== "ADFS" && this.state.provider.type !== "AzureAD" && this.state.provider.type !== "Casdoor" && this.state.provider.type !== "Okta" ? null : (
            <Row style={{marginTop: "20px"}} >
              <Col style={{marginTop: "5px"}} span={2}>
                {Setting.getLabel(i18next.t("provider:Domain"), i18next.t("provider:Domain - Tooltip"))} :
              </Col>
              <Col span={22} >
                <Input prefix={<LinkOutlined />} value={this.state.provider.domain} onChange={e => {
                  this.updateProviderField("domain", e.target.value);
                }} />
              </Col>
            </Row>
          )
        }
        {this.state.provider.category === "Storage" ? (
          <div>
            {["Local File System"].includes(this.state.provider.type) ? null : (
              <Row style={{marginTop: "20px"}} >
                <Col style={{marginTop: "5px"}} span={2}>
                  {Setting.getLabel(i18next.t("provider:Endpoint"), i18next.t("provider:Region endpoint for Internet"))} :
                </Col>
                <Col span={22} >
                  <Input prefix={<LinkOutlined />} value={this.state.provider.endpoint} onChange={e => {
                    this.updateProviderField("endpoint", e.target.value);
                  }} />
                </Col>
              </Row>
            )}
            {["Local File System", "MinIO", "Tencent Cloud COS", "Google Cloud Storage", "Qiniu Cloud Kodo"].includes(this.state.provider.type) ? null : (
              <Row style={{marginTop: "20px"}} >
                <Col style={{marginTop: "5px"}} span={2}>
                  {Setting.getLabel(i18next.t("provider:Endpoint (Intranet)"), i18next.t("provider:Region endpoint for Intranet"))} :
                </Col>
                <Col span={22} >
                  <Input prefix={<LinkOutlined />} value={this.state.provider.intranetEndpoint} onChange={e => {
                    this.updateProviderField("intranetEndpoint", e.target.value);
                  }} />
                </Col>
              </Row>
            )}
            {["Local File System"].includes(this.state.provider.type) ? null : (
              <Row style={{marginTop: "20px"}} >
                <Col style={{marginTop: "5px"}} span={2}>
                  {Setting.getLabel(i18next.t("provider:Bucket"), i18next.t("provider:Bucket - Tooltip"))} :
                </Col>
                <Col span={22} >
                  <Input value={this.state.provider.bucket} onChange={e => {
                    this.updateProviderField("bucket", e.target.value);
                  }} />
                </Col>
              </Row>
            )}
            <Row style={{marginTop: "20px"}} >
              <Col style={{marginTop: "5px"}} span={2}>
                {Setting.getLabel(i18next.t("provider:Path prefix"), i18next.t("provider:Path prefix - Tooltip"))} :
              </Col>
              <Col span={22} >
                <Input value={this.state.provider.pathPrefix} onChange={e => {
                  this.updateProviderField("pathPrefix", e.target.value);
                }} />
              </Col>
            </Row>
            {["MinIO", "Google Cloud Storage", "Qiniu Cloud Kodo"].includes(this.state.provider.type) ? null : (
              <Row style={{marginTop: "20px"}} >
                <Col style={{marginTop: "5px"}} span={2}>
                  {Setting.getLabel(i18next.t("provider:Domain"), i18next.t("provider:Domain - Tooltip"))} :
                </Col>
                <Col span={22} >
                  <Input prefix={<LinkOutlined />} value={this.state.provider.domain} disabled={this.state.provider.type === "Local File System"} onChange={e => {
                    this.updateProviderField("domain", e.target.value);
                  }} />
                </Col>
              </Row>
            )}
            {["AWS S3", "Tencent Cloud COS", "Qiniu Cloud Kodo"].includes(this.state.provider.type) ? (
              <Row style={{marginTop: "20px"}} >
                <Col style={{marginTop: "5px"}} span={2}>
                  {Setting.getLabel(i18next.t("provider:Region ID"), i18next.t("provider:Region ID - Tooltip"))} :
                </Col>
                <Col span={22} >
                  <Input value={this.state.provider.regionId} onChange={e => {
                    this.updateProviderField("regionId", e.target.value);
                  }} />
                </Col>
              </Row>
            ) : null}
          </div>
        ) : null}
        {this.getAppIdRow(this.state.provider)}
        {
          this.state.provider.category === "Notification" ? (
            <React.Fragment>
              {["Custom HTTP"].includes(this.state.provider.type) ? (
                <Row style={{marginTop: "20px"}} >
                  <Col style={{marginTop: "5px"}} span={2}>
                    {Setting.getLabel(i18next.t("general:Method"), i18next.t("provider:Method - Tooltip"))} :
                  </Col>
                  <Col span={22} >
                    <Select virtual={false} style={{width: "100%"}} value={this.state.provider.method} onChange={value => {
                      this.updateProviderField("method", value);
                    }}>
                      {
                        [
                          {id: "GET", name: "GET"},
                          {id: "POST", name: "POST"},
                        ].map((method, index) => <Option key={index} value={method.id}>{method.name}</Option>)
                      }
                    </Select>
                  </Col>
                </Row>
              ) : null}
              {["Custom HTTP"].includes(this.state.provider.type) ? (
                <Row style={{marginTop: "20px"}} >
                  <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                    {Setting.getLabel(i18next.t("provider:Parameter"), i18next.t("provider:Parameter - Tooltip"))} :
                  </Col>
                  <Col span={22} >
                    <Input value={this.state.provider.title} onChange={e => {
                      this.updateProviderField("title", e.target.value);
                    }} />
                  </Col>
                </Row>
              ) : null}
              {["Google Chat"].includes(this.state.provider.type) ? (
                <Row style={{marginTop: "20px"}} >
                  <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                    {Setting.getLabel(i18next.t("provider:Metadata"), i18next.t("provider:Metadata - Tooltip"))} :
                  </Col>
                  <Col span={22}>
                    <TextArea rows={4} value={this.state.provider.metadata} onChange={e => {
                      this.updateProviderField("metadata", e.target.value);
                    }} />
                  </Col>
                </Row>
              ) : null}
              <Row style={{marginTop: "20px"}} >
                <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                  {Setting.getLabel(i18next.t("provider:Content"), i18next.t("provider:Content - Tooltip"))} :
                </Col>
                <Col span={22} >
                  <TextArea autoSize={{minRows: 3, maxRows: 100}} value={this.state.provider.content} onChange={e => {
                    this.updateProviderField("content", e.target.value);
                  }} />
                </Col>
              </Row>
              <Row style={{marginTop: "20px"}} >
                {this.getReceiverRow(this.state.provider)}
                <Button style={{marginLeft: "10px", marginBottom: "5px"}} type="primary"
                  onClick={() => ProviderNotification.sendTestNotification(this.state.provider, this.state.provider.receiver)} >
                  {i18next.t("provider:Send Testing Notification")}
                </Button>
              </Row>
            </React.Fragment>
          ) : this.state.provider.category === "Email" ? (
            <React.Fragment>
              <Row style={{marginTop: "20px"}} >
                <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                  {Setting.getLabel(i18next.t("provider:Host"), i18next.t("provider:Host - Tooltip"))} :
                </Col>
                <Col span={22} >
                  <Input prefix={<LinkOutlined />} value={this.state.provider.host} onChange={e => {
                    this.updateProviderField("host", e.target.value);
                  }} />
                </Col>
              </Row>
              <Row style={{marginTop: "20px"}} >
                <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                  {Setting.getLabel(i18next.t("cert:CA Certificate"), i18next.t("cert:CA Certificate - Tooltip"))} :
                </Col>
                <Col span={21} >
                  <Select virtual={false} style={{width: "100%"}} value={this.state.provider.cert} onChange={(value => {this.updateProviderField("cert", value);})}>
                    {
                      this.state.caCerts.map((cert, index) => <Option key={index} value={cert.name}>{cert.name}</Option>)
                    }
                  </Select>
                </Col>
                <Col style={{paddingLeft: "5px"}} span={1} >
                  <Button icon={<ClearOutlined />} type="text" onClick={() => {this.updateProviderField("cert", "");}} >
                  </Button>
                </Col>
              </Row>
              {["Azure ACS"].includes(this.state.provider.type) ? null : (
                <Row style={{marginTop: "20px"}} >
                  <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                    {Setting.getLabel(i18next.t("provider:Port"), i18next.t("provider:Port - Tooltip"))} :
                  </Col>
                  <Col span={22} >
                    <InputNumber value={this.state.provider.port} onChange={value => {
                      this.updateProviderField("port", value);
                    }} />
                  </Col>
                </Row>
              )}
              {["Azure ACS"].includes(this.state.provider.type) ? null : (
                <Row style={{marginTop: "20px"}} >
                  <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                    {Setting.getLabel(i18next.t("provider:Disable SSL"), i18next.t("provider:Disable SSL - Tooltip"))} :
                  </Col>
                  <Col span={1} >
                    <Switch checked={this.state.provider.disableSsl} onChange={checked => {
                      this.updateProviderField("disableSsl", checked);
                    }} />
                  </Col>
                </Row>
              )}
              <Row style={{marginTop: "20px"}} >
                <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                  {Setting.getLabel(i18next.t("provider:Invite email title"), i18next.t("provider:Invite email title - Tooltip"))} :
                </Col>
                <Col span={22} >
                  <Input value={this.state.provider.inviteTitle} onChange={e => {
                    this.updateProviderField("inviteTitle", e.target.value);
                  }} />
                </Col>
              </Row>
              <Row style={{marginTop: "20px"}} >
                <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                  {Setting.getLabel(i18next.t("provider:Invite email content"), i18next.t("provider:Invite email content - Tooltip"))} :
                </Col>
                <Col span={22} >
                  <TextArea autoSize={{minRows: 3, maxRows: 100}} value={this.state.provider.inviteContent} onChange={e => {
                    this.updateProviderField("inviteContent", e.target.value);
                  }} />
                </Col>
              </Row>
              <Row style={{marginTop: "20px"}} >
                <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                  {Setting.getLabel(i18next.t("provider:Email title"), i18next.t("provider:Email title - Tooltip"))} :
                </Col>
                <Col span={22} >
                  <Input value={this.state.provider.title} onChange={e => {
                    this.updateProviderField("title", e.target.value);
                  }} />
                </Col>
              </Row>
              <Row style={{marginTop: "20px"}} >
                <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                  {Setting.getLabel(i18next.t("provider:Email content"), i18next.t("provider:Email content - Tooltip"))} :
                </Col>
                <Col span={22} >
                  <TextArea autoSize={{minRows: 3, maxRows: 100}} value={this.state.provider.content} onChange={e => {
                    this.updateProviderField("content", e.target.value);
                  }} />
                </Col>
              </Row>
              <Row style={{marginTop: "20px"}} >
                <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                  {Setting.getLabel(i18next.t("provider:Test Email"), i18next.t("provider:Test Email - Tooltip"))} :
                </Col>
                <Col span={4} >
                  <Input value={this.state.provider.receiver} placeholder = {i18next.t("user:Input your email")} onChange={e => {
                    this.updateProviderField("receiver", e.target.value);
                  }} />
                </Col>
                {["Azure ACS"].includes(this.state.provider.type) ? null : (
                  <Button style={{marginLeft: "10px", marginBottom: "5px"}} type="primary" onClick={() => ProviderEditTestEmail.connectSmtpServer(this.state.provider)} >
                    {i18next.t("provider:Test SMTP Connection")}
                  </Button>
                )}
                <Button style={{marginLeft: "10px", marginBottom: "5px"}} type="primary"
                  disabled={!Setting.isValidEmail(this.state.provider.receiver)}
                  onClick={() => ProviderEditTestEmail.sendTestEmail(this.state.provider, this.state.provider.receiver)} >
                  {i18next.t("provider:Send Testing Email")}
                </Button>
              </Row>
            </React.Fragment>
          ) : this.state.provider.category === "SMS" ? (
            <React.Fragment>
              {["Twilio SMS", "Amazon SNS", "Azure ACS", "Msg91 SMS", "Infobip SMS"].includes(this.state.provider.type) ?
                null :
                (<Row style={{marginTop: "20px"}} >
                  <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                    {Setting.getLabel(i18next.t("provider:Sign Name"), i18next.t("provider:Sign Name - Tooltip"))} :
                  </Col>
                  <Col span={22} >
                    <Input value={this.state.provider.signName} onChange={e => {
                      this.updateProviderField("signName", e.target.value);
                    }} />
                  </Col>
                </Row>
                )
              }
              {["Infobip SMS"].includes(this.state.provider.type) ?
                null :
                (<Row style={{marginTop: "20px"}} >
                  <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                    {Setting.getLabel(i18next.t("provider:Template code"), i18next.t("provider:Template code - Tooltip"))} :
                  </Col>
                  <Col span={22} >
                    <Input value={this.state.provider.templateCode} onChange={e => {
                      this.updateProviderField("templateCode", e.target.value);
                    }} />
                  </Col>
                </Row>
                )
              }
              <Row style={{marginTop: "20px"}} >
                <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                  {Setting.getLabel(i18next.t("provider:SMS Test"), i18next.t("provider:SMS Test - Tooltip"))} :
                </Col>
                <Col span={4} >
                  <Input.Group compact>
                    <CountryCodeSelect
                      style={{width: "90px"}}
                      initValue={this.state.provider.content}
                      onChange={(value) => {
                        this.updateProviderField("content", value);
                      }}
                      countryCodes={this.props.account.organization.countryCodes}
                    />
                    <Input value={this.state.provider.receiver}
                      style={{width: "150px"}}
                      placeholder = {i18next.t("user:Input your phone number")}
                      onChange={e => {
                        this.updateProviderField("receiver", e.target.value);
                      }} />
                  </Input.Group>
                </Col>
                <Col span={2} >
                  <Button style={{marginLeft: "10px", marginBottom: "5px"}} type="primary"
                    disabled={!Setting.isValidPhone(this.state.provider.receiver)}
                    onClick={() => ProviderEditTestSms.sendTestSms(this.state.provider, "+" + Setting.getCountryCode(this.state.provider.content) + this.state.provider.receiver)} >
                    {i18next.t("provider:Send Testing SMS")}
                  </Button>
                </Col>
              </Row>
            </React.Fragment>
          ) : this.state.provider.category === "SAML" ? (
            <React.Fragment>
              <Row style={{marginTop: "20px"}} >
                <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                  {Setting.getLabel(i18next.t("provider:Name ID Format"), i18next.t("provider:Name ID Format - Tooltip"))} :
                </Col>
                <Col span={22} >
                  <Select virtual={false} style={{width: "100%"}} value={this.state.provider.nameIdFormat} onChange={(value => {
                    this.updateProviderField("nameIdFormat", value);
                  })}>
                    {
                      [
                        {id: Setting.SamlNameIdFormatPersistent, name: Setting.SamlNameIdFormatPersistent},
                        {id: Setting.SamlNameIdFormatTransient, name: Setting.SamlNameIdFormatTransient},
                        {id: Setting.SamlNameIdFormatEmailAddress, name: Setting.SamlNameIdFormatEmailAddress},
                        {id: Setting.SamlNameIdFormatUnspecified, name: Setting.SamlNameIdFormatUnspecified},
                      ].map((item, index) => <Option key={index} value={item.id}>{item.name}</Option>)
                    }
                  </Select>
                </Col>
              </Row>
              <Row style={{marginTop: "20px"}} >
                <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                  {Setting.getLabel(i18next.t("provider:Sign request"), i18next.t("provider:Sign request - Tooltip"))} :
                </Col>
                <Col span={22} >
                  <Select virtual={false} style={{width: "100%"}} value={this.state.provider.requestSignature} onChange={(value => {
                    this.updateProviderField("requestSignature", value);
                  })}>
                    {
                      [
                        {id: Setting.SamlNoRequestSign, name: Setting.SamlNoRequestSign},
                        {id: Setting.SamlSignRequestWithFile, name: Setting.SamlSignRequestWithFile},
                        {id: Setting.SamlSignRequestWithCertificate, name: Setting.SamlSignRequestWithCertificate},
                      ].map((item, index) => <Option key={index} value={item.id}>{item.name}</Option>)
                    }
                  </Select>
                </Col>
              </Row>
              {
                this.state.provider.requestSignature !== Setting.SamlNoRequestSign ? (
                  <Row style={{marginTop: "20px"}} >
                    <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                      {Setting.getLabel(i18next.t("provider:Signature algorithm"), i18next.t("provider:Signature algorithm - Tooltip"))} :
                    </Col>
                    <Col span={22} >
                      <Select virtual={false} style={{width: "100%"}} value={this.state.provider.signatureAlgorithm} onChange={(value => {
                        this.updateProviderField("signatureAlgorithm", value);
                      })}>
                        {
                          [
                            {id: Setting.RSA_SHA_1, name: Setting.RSA_SHA_1},
                            {id: Setting.RSA_SHA_256, name: Setting.RSA_SHA_256},
                            {id: Setting.RSA_SHA_512, name: Setting.RSA_SHA_512},
                          ].map((item, index) => <Option key={index} value={item.id}>{item.name}</Option>)
                        }
                      </Select>
                    </Col>
                  </Row>
                ) : null
              }
              {
                this.state.provider.requestSignature === Setting.SamlSignRequestWithCertificate ? (
                  <Row style={{marginTop: "20px"}} >
                    <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                      {Setting.getLabel(i18next.t("cert:Client Certificate"), i18next.t("cert:Client Certificate - Tooltip"))} :
                    </Col>
                    <Col span={21} >
                      <Select virtual={false} style={{width: "100%"}} value={this.state.provider.cert} onChange={(value => {this.updateProviderField("cert", value);})}>
                        {
                          this.state.clientCerts.map((cert, index) => <Option key={index} value={cert.name}>{cert.name}</Option>)
                        }
                      </Select>
                    </Col>
                    <Col style={{paddingLeft: "5px"}} span={1} >
                      <Button icon={<ClearOutlined />} type="text" onClick={() => {this.updateProviderField("cert", "");}} >
                      </Button>
                    </Col>
                  </Row>
                ) : null
              }
              <Row style={{marginTop: "20px"}} >
                <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                  {Setting.getLabel(i18next.t("provider:Metadata"), i18next.t("provider:Metadata - Tooltip"))} :
                </Col>
                <Col span={22}>
                  <TextArea rows={4} value={this.state.provider.metadata} onChange={e => {
                    this.updateProviderField("metadata", e.target.value);
                  }} />
                </Col>
              </Row>
              <Row style={{marginTop: "20px"}}>
                <Col style={{marginTop: "5px"}} span={2} />
                <Col span={2}>
                  <Button type="primary" onClick={() => {
                    try {
                      this.loadSamlConfiguration();
                      Setting.showMessage("success", i18next.t("provider:Parse metadata successfully"));
                    } catch (err) {
                      Setting.showMessage("error", i18next.t("provider:Can not parse metadata"));
                    }
                  }}>
                    {i18next.t("provider:Parse")}
                  </Button>
                </Col>
              </Row>
              <Row style={{marginTop: "20px"}} >
                <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                  {Setting.getLabel(i18next.t("provider:Endpoint Type (HTTP)"), i18next.t("provider:SAML 2.0 Endpoint Type (HTTP)"))} :
                </Col>
                <Col span={22} >
                  <Select virtual={false} style={{width: "100%"}} value={this.state.provider.endpointType} onChange={(value => {
                    this.updateProviderField("endpointType", value);
                    this.updateProviderField("endpoint", "");
                  })}>
                    {
                      [
                        {id: "HTTP-POST", name: "HTTP-POST"},
                        {id: "HTTP-Redirect", name: "HTTP-Redirect"},
                      ]
                        .map((endpointType, index) => <Option key={index} value={endpointType.id}>{endpointType.name}</Option>)
                    }
                  </Select>
                </Col>
              </Row>
              <Row style={{marginTop: "20px"}} >
                <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                  {Setting.getLabel(i18next.t("provider:Endpoint"), i18next.t("provider:SAML 2.0 Endpoint (HTTP)"))} :
                </Col>
                <Col span={22} >
                  <Input value={this.state.provider.endpoint} onChange={e => {
                    this.updateProviderField("endpoint", e.target.value);
                  }} />
                </Col>
              </Row>
              <Row style={{marginTop: "20px"}} >
                <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                  {Setting.getLabel(i18next.t("provider:Validate IdP signature"), i18next.t("provider:Validate IdP signature - Tooltip"))} :
                </Col>
                <Col span={22} >
                  <Switch checked={this.state.provider.validateIdPSignature} onChange={checked => {
                    this.updateProviderField("validateIdPSignature", checked);
                  }} />
                </Col>
              </Row>
              {
                this.state.provider.validateIdPSignature &&
                  <Row style={{marginTop: "20px"}} >
                    <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                      {Setting.getLabel(i18next.t("provider:IdP"), i18next.t("provider:IdP certificate"))} :
                    </Col>
                    <Col span={22} >
                      <Input value={this.state.provider.idP} onChange={e => {
                        this.updateProviderField("idP", e.target.value);
                      }} />
                    </Col>
                  </Row>
              }
              <Row style={{marginTop: "20px"}} >
                <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                  {Setting.getLabel(i18next.t("provider:Issuer URL"), i18next.t("provider:Issuer URL - Tooltip"))} :
                </Col>
                <Col span={22} >
                  <Input value={this.state.provider.issuerUrl} onChange={e => {
                    this.updateProviderField("issuerUrl", e.target.value);
                  }} />
                </Col>
              </Row>
              <Row style={{marginTop: "20px"}} >
                <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                  {Setting.getLabel(i18next.t("provider:SP ACS URL"), i18next.t("provider:SP ACS URL - Tooltip"))} :
                </Col>
                <Col span={21} >
                  <Input value={`${authConfig.serverUrl}/api/acs`} readOnly="readonly" />
                </Col>
                <Col span={1}>
                  <Button type="primary" onClick={() => {
                    copy(`${authConfig.serverUrl}/api/acs`);
                    Setting.showMessage("success", i18next.t("provider:Link copied to clipboard successfully"));
                  }}>
                    {i18next.t("provider:Copy")}
                  </Button>
                </Col>
              </Row>
              <Row style={{marginTop: "20px"}} >
                <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                  {Setting.getLabel(i18next.t("provider:SP Entity ID"), i18next.t("provider:SP ACS URL - Tooltip"))} :
                </Col>
                <Col span={21} >
                  <Input value={`${authConfig.serverUrl}/api/acs`} readOnly="readonly" />
                </Col>
                <Col span={1}>
                  <Button type="primary" onClick={() => {
                    copy(`${authConfig.serverUrl}/api/acs`);
                    Setting.showMessage("success", i18next.t("provider:Link copied to clipboard successfully"));
                  }}>
                    {i18next.t("provider:Copy")}
                  </Button>
                </Col>
              </Row>
            </React.Fragment>
          ) : null
        }
        {
          (this.state.provider.type === "Alipay" || this.state.provider.type === "WeChat Pay") ? (
            <Row style={{marginTop: "20px"}} >
              <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                {Setting.getLabel(i18next.t("general:Cert"), i18next.t("general:Cert - Tooltip"))} :
              </Col>
              <Col span={22} >
                <Select virtual={false} style={{width: "100%"}} value={this.state.provider.cert} onChange={(value => {this.updateProviderField("cert", value);})}>
                  {
                    this.state.certs.map((cert, index) => <Option key={index} value={cert.name}>{cert.name}</Option>)
                  }
                </Select>
              </Col>
            </Row>
          ) : null
        }
        {
          (this.state.provider.type === "Alipay") ? (
            <Row style={{marginTop: "20px"}} >
              <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                {Setting.getLabel(i18next.t("general:Root Cert"), i18next.t("general:Root Cert - Tooltip"))} :
              </Col>
              <Col span={22} >
                <Select virtual={false} style={{width: "100%"}} value={this.state.provider.metadata} onChange={(value => {this.updateProviderField("metadata", value);})}>
                  {
                    this.state.certs.map((cert, index) => <Option key={index} value={cert.name}>{cert.name}</Option>)
                  }
                </Select>
              </Col>
            </Row>
          ) : null
        }
        {
          this.state.provider.type === "Web3Onboard" ? (
            <Row style={{marginTop: "20px"}} >
              <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                {Setting.getLabel(i18next.t("provider:Wallets"), i18next.t("provider:Wallets - Tooltip"))} :
              </Col>
              <Col span={22}>
                <Checkbox.Group
                  options={Web3Auth.getWeb3OnboardWalletsOptions()}
                  value={() => {
                    try {
                      return JSON.parse(this.state.provider.metadata);
                    } catch {
                      return ["injected"];
                    }
                  }}
                  onChange={options => {
                    this.updateProviderField("metadata", JSON.stringify(options));
                  }}
                />
              </Col>
            </Row>
          ) : null
        }

        {
          this.state.provider.category === "SAML" && this.state.provider.type === "GenericSAML" ? (
            <React.Fragment>
              <Row style={{marginTop: "20px"}} >
                <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                  {Setting.getLabel(i18next.t("provider:Single Logout Service Logout URL"), i18next.t("provider:Single Logout Service Logout URL - Tooltip"))} :
                </Col>
                <Col span={21} >
                  <Input prefix={<LinkOutlined />} value={this.state.provider.singleLogoutServiceUrl} onChange={e => {
                    this.updateProviderField("singleLogoutServiceUrl", e.target.value);
                  }} />
                </Col>
                <Col span={1}>
                  <Button type="primary" onClick={() => {
                    copy(`${authConfig.serverUrl}/api/acs`);
                    Setting.showMessage("success", i18next.t("provider:Link copied to clipboard successfully"));
                  }}>
                    {i18next.t("provider:Copy")}
                  </Button>
                </Col>
              </Row>

              <Row style={{marginTop: "20px"}} >
                <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                  {Setting.getLabel(i18next.t("provider:Base Host URL"), i18next.t("provider:Base Host URL - Tooltip"))} :
                </Col>
                <Col span={22} >
                  <Input value={this.state.provider.baseHostUrl} onChange={e => {
                    this.updateProviderField("baseHostUrl", e.target.value);
                  }} />
                </Col>
              </Row>
            </React.Fragment>
          ) : null
        }

        <Row style={{marginTop: "20px"}} >
          <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
            {Setting.getLabel(i18next.t("provider:Provider URL"), i18next.t("provider:Provider URL - Tooltip"))} :
          </Col>
          <Col span={22} >
            <Input prefix={<LinkOutlined />} value={this.state.provider.providerUrl} onChange={e => {
              this.updateProviderField("providerUrl", e.target.value);
            }} />
          </Col>
        </Row>
        {
          this.state.provider.category !== "Captcha" ? null : (
            <Row style={{marginTop: "20px"}} >
              <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
                {Setting.getLabel(i18next.t("general:Preview"), i18next.t("general:Preview - Tooltip"))} :
              </Col>
              <Col span={22} >
                <CaptchaPreview
                  owner={this.state.provider.owner}
                  name={this.state.provider.name}
                  provider={this.state.provider}
                  providerName={this.state.providerName}
                  captchaType={this.state.provider.type}
                  subType={this.state.provider.subType}
                  clientId={this.state.provider.clientId}
                  clientSecret={this.state.provider.clientSecret}
                  clientId2={this.state.provider.clientId2}
                  clientSecret2={this.state.provider.clientSecret2}
                  providerUrl={this.state.provider.providerUrl}
                />
              </Col>
            </Row>
          )
        }
      </Card>
    );
  }

  submitProviderEdit(willExist) {
    const provider = Setting.deepCopy(this.state.provider);
    ProviderBackend.updateProvider(this.state.owner, this.state.providerName, provider)
      .then((res) => {
        if (res.status === "ok") {
          Setting.showMessage("success", i18next.t("general:Successfully saved"));
          this.setState({
            owner: this.state.provider.owner,
            providerName: this.state.provider.name,
          });

          if (willExist) {
            this.props.history.push("/providers");
          } else {
            this.props.history.push(`/providers/${this.state.provider.owner}/${this.state.provider.name}`);
          }
        } else {
          Setting.showMessage("error", `${i18next.t("general:Failed to save")}: ${res.msg}`);
          this.updateProviderField("name", this.state.providerName);
        }
      })
      .catch(error => {
        Setting.showMessage("error", `${i18next.t("general:Failed to connect to server")}: ${error}`);
      });
  }

  deleteProvider() {
    ProviderBackend.deleteProvider(this.state.provider)
      .then((res) => {
        if (res.status === "ok") {
          this.props.history.push("/providers");
        } else {
          Setting.showMessage("error", `${i18next.t("general:Failed to delete")}: ${res.msg}`);
        }
      })
      .catch(error => {
        Setting.showMessage("error", `${i18next.t("general:Failed to connect to server")}: ${error}`);
      });
  }

  render() {
    return (
      <div>
        {
          this.state.provider !== null ? this.renderProvider() : null
        }
        <div style={{marginTop: "20px", marginLeft: "40px"}}>
          <Button size="large" onClick={() => this.submitProviderEdit(false)}>{i18next.t("general:Save")}</Button>
          <Button style={{marginLeft: "20px"}} type="primary" size="large" onClick={() => this.submitProviderEdit(true)}>{i18next.t("general:Save & Exit")}</Button>
          {this.state.mode === "add" ? <Button style={{marginLeft: "20px"}} size="large" onClick={() => this.deleteProvider()}>{i18next.t("general:Cancel")}</Button> : null}
        </div>
      </div>
    );
  }
}

export default ProviderEditPage;
