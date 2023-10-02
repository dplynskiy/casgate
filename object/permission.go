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

package object

import (
	"strings"

	"github.com/casdoor/casdoor/conf"
	"github.com/casdoor/casdoor/util"
	"github.com/xorm-io/core"
)

type Permission struct {
	Owner       string `xorm:"varchar(100) notnull pk" json:"owner"`
	Name        string `xorm:"varchar(100) notnull pk" json:"name"`
	CreatedTime string `xorm:"varchar(100)" json:"createdTime"`
	DisplayName string `xorm:"varchar(100)" json:"displayName"`
	Description string `xorm:"varchar(100)" json:"description"`

	Groups  []string `xorm:"mediumtext" json:"groups"`
	Users   []string `xorm:"mediumtext" json:"users"`
	Roles   []string `xorm:"mediumtext" json:"roles"`
	Domains []string `xorm:"mediumtext" json:"domains"`

	Model        string   `xorm:"varchar(100)" json:"model"`
	Adapter      string   `xorm:"varchar(100)" json:"adapter"`
	ResourceType string   `xorm:"varchar(100)" json:"resourceType"`
	Resources    []string `xorm:"mediumtext" json:"resources"`
	Actions      []string `xorm:"mediumtext" json:"actions"`
	Effect       string   `xorm:"varchar(100)" json:"effect"`
	IsEnabled    bool     `json:"isEnabled"`

	Submitter   string `xorm:"varchar(100)" json:"submitter"`
	Approver    string `xorm:"varchar(100)" json:"approver"`
	ApproveTime string `xorm:"varchar(100)" json:"approveTime"`
	State       string `xorm:"varchar(100)" json:"state"`
}

type PermissionRule struct {
	Ptype string `xorm:"varchar(100) index not null default ''" json:"ptype"`
	V0    string `xorm:"varchar(100) index not null default ''" json:"v0"`
	V1    string `xorm:"varchar(100) index not null default ''" json:"v1"`
	V2    string `xorm:"varchar(100) index not null default ''" json:"v2"`
	V3    string `xorm:"varchar(100) index not null default ''" json:"v3"`
	V4    string `xorm:"varchar(100) index not null default ''" json:"v4"`
	V5    string `xorm:"varchar(100) index not null default ''" json:"v5"`
	Id    string `xorm:"varchar(100) index not null default ''" json:"id"`
}

const builtInAvailableField = 5

func (p *Permission) GetId() string {
	return util.GetId(p.Owner, p.Name)
}

func GetPermissionCount(owner, field, value string) (int64, error) {
	session := GetSession(owner, -1, -1, field, value, "", "")
	return session.Count(&Permission{})
}

func GetPermissions(owner string) ([]*Permission, error) {
	permissions := []*Permission{}
	err := ormer.Engine.Desc("created_time").Find(&permissions, &Permission{Owner: owner})
	if err != nil {
		return permissions, err
	}

	return permissions, nil
}

func GetPaginationPermissions(owner string, offset, limit int, field, value, sortField, sortOrder string) ([]*Permission, error) {
	permissions := []*Permission{}
	session := GetSession(owner, offset, limit, field, value, sortField, sortOrder)
	err := session.Find(&permissions)
	if err != nil {
		return permissions, err
	}

	return permissions, nil
}

func getPermission(owner string, name string) (*Permission, error) {
	if owner == "" || name == "" {
		return nil, nil
	}

	permission := Permission{Owner: owner, Name: name}
	existed, err := ormer.Engine.Get(&permission)
	if err != nil {
		return &permission, err
	}

	if existed {
		return &permission, nil
	} else {
		return nil, nil
	}
}

func GetPermission(id string) (*Permission, error) {
	owner, name := util.GetOwnerAndNameFromIdNoCheck(id)
	return getPermission(owner, name)
}

func UpdatePermission(id string, permission *Permission) (bool, error) {
	owner, name := util.GetOwnerAndNameFromIdNoCheck(id)
	oldPermission, err := getPermission(owner, name)
	if oldPermission == nil {
		return false, nil
	}

	affected, err := ormer.Engine.ID(core.PK{owner, name}).AllCols().Update(permission)
	if err != nil {
		return false, err
	}

	if affected != 0 {
		err = processPolicyDifference([]*Permission{permission})
		if err != nil {
			return false, err
		}
	}

	return affected != 0, nil
}

func AddPermission(permission *Permission) (bool, error) {
	affected, err := ormer.Engine.Insert(permission)
	if err != nil {
		return false, err
	}

	if affected != 0 {
		err = processPolicyDifference([]*Permission{permission})
		if err != nil {
			return false, err
		}
	}

	return affected != 0, nil
}

func AddPermissions(permissions []*Permission) bool {
	if len(permissions) == 0 {
		return false
	}

	affected, err := ormer.Engine.Insert(permissions)
	if err != nil {
		if !strings.Contains(err.Error(), "Duplicate entry") {
			panic(err)
		}
	}

	if affected != 0 {
		err = processPolicyDifference(permissions)
		if err != nil {
			panic(err)
		}
	}
	return affected != 0
}

func AddPermissionsInBatch(permissions []*Permission) bool {
	batchSize := conf.GetConfigBatchSize()

	if len(permissions) == 0 {
		return false
	}

	affected := false
	for i := 0; i < (len(permissions)-1)/batchSize+1; i++ {
		start := i * batchSize
		end := (i + 1) * batchSize
		if end > len(permissions) {
			end = len(permissions)
		}

		tmp := permissions[start:end]
		if AddPermissions(tmp) {
			affected = true
		}
	}

	return affected
}

func DeletePermission(permission *Permission) (bool, error) {
	oldPermission, err := getPermission(permission.Owner, permission.Name)
	if oldPermission == nil {
		return false, nil
	}

	affected, err := ormer.Engine.ID(core.PK{permission.Owner, permission.Name}).Delete(&Permission{})
	if err != nil {
		return false, err
	}

	if affected != 0 {
		err = processPolicyDifference([]*Permission{oldPermission})
		if err != nil {
			return false, err
		}
	}

	return affected != 0, nil
}

func GetPermissionsAndRolesByUser(userId string) ([]*Permission, []*Role, error) {
	permissions := []*Permission{}
	err := ormer.Engine.Where("users like ?", "%"+userId+"\"%").Find(&permissions)
	if err != nil {
		return nil, nil, err
	}

	existedPerms := map[string]struct{}{}

	for _, perm := range permissions {
		perm.Users = nil

		if _, ok := existedPerms[perm.Name]; !ok {
			existedPerms[perm.Name] = struct{}{}
		}
	}

	permFromRoles := []*Permission{}

	roles, err := GetRolesByUser(userId)
	if err != nil {
		return nil, nil, err
	}

	for _, role := range roles {
		perms := []*Permission{}
		err := ormer.Engine.Where("roles like ?", "%"+role.GetId()+"\"%").Find(&perms)
		if err != nil {
			return nil, nil, err
		}
		permFromRoles = append(permFromRoles, perms...)
	}

	for _, perm := range permFromRoles {
		perm.Users = nil
		if _, ok := existedPerms[perm.Name]; !ok {
			existedPerms[perm.Name] = struct{}{}
			permissions = append(permissions, perm)
		}
	}

	return permissions, roles, nil
}

func GetPermissionsByGroup(groupId string) ([]*Permission, error) {
	permissions := []*Permission{}
	err := ormer.Engine.Where("`groups` like ?", "%"+groupId+"\"%").Find(&permissions)
	if err != nil {
		return permissions, err
	}

	return permissions, nil
}

func GetPermissionsByDomain(domainId string) ([]*Permission, error) {
	permissions := []*Permission{}
	err := ormer.Engine.Where("domains like ?", "%"+domainId+"\"%").Find(&permissions)
	if err != nil {
		return permissions, err
	}

	return permissions, nil
}

func GetPermissionsByRole(roleId string) ([]*Permission, error) {
	permissions := []*Permission{}
	err := ormer.Engine.Where("roles like ?", "%"+roleId+"\"%").Find(&permissions)
	if err != nil {
		return permissions, err
	}

	return permissions, nil
}

func GetPermissionsByResource(resourceId string) ([]*Permission, error) {
	permissions := []*Permission{}
	err := ormer.Engine.Where("resources like ?", "%"+resourceId+"\"%").Find(&permissions)
	if err != nil {
		return permissions, err
	}

	return permissions, nil
}

func GetPermissionsBySubmitter(owner string, submitter string) ([]*Permission, error) {
	permissions := []*Permission{}
	err := ormer.Engine.Desc("created_time").Find(&permissions, &Permission{Owner: owner, Submitter: submitter})
	if err != nil {
		return permissions, err
	}

	return permissions, nil
}

func GetPermissionsByModel(owner string, model string) ([]*Permission, error) {
	permissions := []*Permission{}
	err := ormer.Engine.Desc("created_time").Find(&permissions, &Permission{Owner: owner, Model: model})
	if err != nil {
		return permissions, err
	}

	return permissions, nil
}

func ContainsAsterisk(userId string, users []string) bool {
	containsAsterisk := false
	group, _ := util.GetOwnerAndNameFromId(userId)
	for _, user := range users {
		permissionGroup, permissionUserName := util.GetOwnerAndNameFromId(user)
		if permissionGroup == group && permissionUserName == "*" {
			containsAsterisk = true
			break
		}
	}

	return containsAsterisk
}

func GetMaskedPermissions(permissions []*Permission) []*Permission {
	for _, permission := range permissions {
		permission.Users = nil
		permission.Submitter = ""
	}

	return permissions
}

// GroupPermissionsByModelAdapter group permissions by model and adapter.
// Every model and adapter will be a key, and the value is a list of permission ids.
// With each list of permission ids have the same key, we just need to init the
// enforcer and do the enforce/batch-enforce once (with list of permission ids
// as the policyFilter when the enforcer load policy).
func GroupPermissionsByModelAdapter(permissions []*Permission) map[string][]string {
	m := make(map[string][]string)

	for _, permission := range permissions {
		key := permission.Model + permission.Adapter
		permissionIds, ok := m[key]
		if !ok {
			m[key] = []string{permission.GetId()}
		} else {
			m[key] = append(permissionIds, permission.GetId())
		}
	}

	return m
}
