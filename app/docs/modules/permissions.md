# 用户权限与安全控制模块

## 概述

用户权限与安全控制模块实现五级权限模型，对删除、权限变更等高风险操作强制二次确认，确保数据安全。该模块采用RBAC (Role-Based Access Control) 权限模型，结合ABAC (Attribute-Based Access Control) 提供细粒度的访问控制。

## 权限模型设计

### 五级权限体系

```typescript
enum PermissionLevel {
  OWNER = 5,      // 所有者 - 完全控制权
  ADMIN = 4,      // 管理员 - 除所有者转让外的所有权限
  EDITOR = 3,     // 编辑者 - 可编辑内容，管理协作者
  COMMENTER = 2,  // 评论者 - 可查看和评论，不可编辑
  VIEWER = 1      // 查看者 - 仅可查看
}

interface UserPermission {
  userId: string;
  documentId: string;
  level: PermissionLevel;
  grantedBy: string;
  grantedAt: Date;
  expiresAt?: Date;
  conditions?: PermissionCondition[];
}
```

### 权限映射表

| 权限等级 | 查看 | 编辑 | 评论 | 删除 | 分享 | 管理协作者 | 权限设置 | 转让所有权 |
|---------|------|------|------|------|------|-----------|----------|----------|
| 所有者   | ✅   | ✅   | ✅   | ✅   | ✅   | ✅        | ✅       | ✅       |
| 管理员   | ✅   | ✅   | ✅   | ✅   | ✅   | ✅        | ❌       | ❌       |
| 编辑者   | ✅   | ✅   | ✅   | ❌   | ❌   | ❌        | ❌       | ❌       |
| 评论者   | ✅   | ❌   | ✅   | ❌   | ❌   | ❌        | ❌       | ❌       |
| 查看者   | ✅   | ❌   | ❌   | ❌   | ❌   | ❌        | ❌       | ❌       |

### 文档共享权限控制

> 说明：本节聚焦在“谁可以分享、谁可以改别人权限、如何撤回分享”等权限规则。文档共享的数据模型、共享工作区以及前端页面交互设计，请参考[文档管理模块](./document-management.md)中的“文档共享与共享工作区”一节。

文档共享能力基于以上五级权限体系进行约束，并与文档管理模块中的 `DocumentShare` 模型保持一致：

- 只有文档创建者（PermissionLevel.OWNER）可以发起文档分享，创建或更新 DocumentShare 记录。
- 只有文档创建者可以调整其他用户在该文档上的共享权限等级（修改 DocumentShare.level）。
- 只有文档创建者可以撤回对某个用户的分享（将 DocumentShare.status 变更为 revoked），或批量撤回整份文档的所有分享。
- 管理员（PermissionLevel.ADMIN）和其他协作者可以查看已有的共享列表和自己的权限状态，但不能为他人新增或修改共享记录。
- 被分享用户通过分享链接接受文档时，只能在创建者预先授予的权限范围内生效，不能提升自己的权限等级。

在实际权限校验时，文档的有效权限由两部分组成：

- 直接权限：UserPermission.level（例如用户作为协作者被添加到文档中）。
- 共享权限：DocumentShare.level（用户通过“共享文档”获得的权限）。

系统应取两者中的最高等级作为该用户对该文档的最终权限，并继续遵守“只有创建者可以发起分享、修改他人权限和撤回分享”的原则，确保共享逻辑与 RBAC 五级权限模型完全对齐。

## 安全控制机制

### 1. 身份认证

**认证方式**:
- **JWT令牌认证**: 基于HTTP头的Bearer token
- **会话认证**: 基于Cookie的安全会话
- **双因子认证**: 可选的2FA增强安全
- **第三方登录**: 支持OAuth2.0集成

**认证流程**:
```typescript
interface AuthToken {
  userId: string;
  sessionId: string;
  permissions: string[];
  issuedAt: Date;
  expiresAt: Date;
  deviceId?: string;
  ipAddress?: string;
}

// 登录流程
POST /api/auth/login
{
  "username": "user@example.com",
  "password": "hashed_password",
  "deviceId": "device-123"
}

// 响应
{
  "token": "jwt_token_here",
  "refreshToken": "refresh_token_here",
  "user": { ... },
  "permissions": [...]
}
```

### 2. 访问控制

**RBAC实现**:
```typescript
class PermissionManager {
  // 检查用户权限
  async checkPermission(userId: string, resource: string, action: string): Promise<boolean> {
    const userRoles = await this.getUserRoles(userId);
    const resourcePermissions = await this.getResourcePermissions(resource);

    return this.evaluatePermissions(userRoles, resourcePermissions, action);
  }

  // 获取用户角色
  async getUserRoles(userId: string): Promise<Role[]> {
    // 从数据库获取用户角色
  }

  // 权限评估
  evaluatePermissions(roles: Role[], permissions: Permission[], action: string): boolean {
    // 权限评估逻辑
  }
}
```

**ABAC扩展**:
```typescript
interface PermissionCondition {
  attribute: string;  // 如: time, location, department
  operator: 'eq' | 'gt' | 'lt' | 'in' | 'between';
  value: any;
  logic: 'AND' | 'OR';
}

// 示例条件权限
{
  "conditions": [
    {
      "attribute": "department",
      "operator": "eq",
      "value": "engineering",
      "logic": "AND"
    },
    {
      "attribute": "time",
      "operator": "between",
      "value": ["09:00", "17:00"],
      "logic": "AND"
    }
  ]
}
```

### 3. 操作审计

**审计日志设计**:
```typescript
interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  details?: any;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

enum AuditAction {
  DOCUMENT_CREATE = 'document.create',
  DOCUMENT_UPDATE = 'document.update',
  DOCUMENT_DELETE = 'document.delete',
  PERMISSION_GRANT = 'permission.grant',
  PERMISSION_REVOKE = 'permission.revoke',
  USER_LOGIN = 'user.login',
  USER_LOGOUT = 'user.logout'
}
```

**审计功能**:
- 实时日志记录
- 风险等级评估
- 可疑活动检测
- 合规报告生成

## 二次确认机制

### 高风险操作识别

**高风险操作列表**:
- 删除文档/文件夹
- 更改用户权限
- 转让文档所有权
- 永久删除回收站项目
- 修改安全设置

### 二次确认流程

**确认机制**:
```typescript
interface ConfirmationRequest {
  id: string;
  userId: string;
  action: string;
  resource: string;
  riskLevel: 'medium' | 'high' | 'critical';
  expiresAt: Date;
  confirmationCode?: string;
  confirmedBy?: string[];
  status: 'pending' | 'confirmed' | 'expired' | 'cancelled';
}

// 发起二次确认
POST /api/confirmations
{
  "action": "document.delete",
  "resource": "document-123",
  "reason": "用户主动删除"
}

// 确认操作
POST /api/confirmations/:id/confirm
{
  "confirmationCode": "123456"
}
```

**确认方式**:
- **邮箱确认**: 发送确认链接到用户邮箱
- **短信确认**: 发送验证码到用户手机
- **应用内确认**: 弹窗二次确认
- **管理员审批**: 高风险操作需要管理员审批

## 数据加密与保护

### 传输加密

**HTTPS强制**:
- 所有API接口强制HTTPS
- HSTS头设置
- 证书固定

**WebSocket安全**:
- WSS协议
- 消息加密
- 连接认证

### 数据存储加密

**数据库加密**:
```typescript
interface EncryptedField {
  encrypted: string;  // 加密数据
  iv: string;        // 初始化向量
  keyVersion: string; // 密钥版本
}

// 敏感字段加密
const encryptField = (data: string): EncryptedField => {
  const key = getCurrentKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher('aes-256-gcm', key);

  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return {
    encrypted,
    iv: iv.toString('hex'),
    keyVersion: currentKeyVersion
  };
};
```

**文件加密**:
- 文档内容加密存储
- 密钥轮换机制
- 零知识证明 (可选)

## 安全监控与响应

### 实时监控

**安全指标**:
- 登录失败次数
- 异常访问模式
- 高风险操作频率
- API调用异常

**告警系统**:
```typescript
interface SecurityAlert {
  id: string;
  type: 'brute_force' | 'suspicious_activity' | 'permission_abuse';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  ipAddress: string;
  description: string;
  triggeredAt: Date;
  resolvedAt?: Date;
}

// 告警规则示例
const alertRules = [
  {
    type: 'brute_force',
    condition: 'login_failures > 5',
    window: '5 minutes',
    severity: 'high'
  },
  {
    type: 'suspicious_activity',
    condition: 'high_risk_actions > 10',
    window: '1 hour',
    severity: 'medium'
  }
];
```

### 响应机制

**自动响应**:
- 临时封禁IP
- 强制密码重置
- 会话终止
- 权限降级

**人工干预**:
- 安全事件调查
- 用户账户恢复
- 系统修复部署

## 合规性支持

### 数据隐私保护

**GDPR合规**:
- 数据最小化收集
- 用户同意机制
- 数据删除权
- 隐私政策透明

**数据保留策略**:
```typescript
interface RetentionPolicy {
  dataType: string;
  retentionPeriod: number; // 天数
  deletionMethod: 'soft' | 'hard';
  legalHold: boolean;
}

// 示例策略
const policies = [
  {
    dataType: 'audit_logs',
    retentionPeriod: 2555, // 7年
    deletionMethod: 'hard',
    legalHold: false
  },
  {
    dataType: 'user_data',
    retentionPeriod: 365 * 3, // 3年
    deletionMethod: 'soft',
    legalHold: false
  }
];
```

### 安全认证

**认证标准**:
- ISO 27001 信息安全管理体系
- SOC 2 Type II 审计
- NIST 网络安全框架

## API 接口设计

### 权限管理 API

```typescript
// 获取用户权限
GET /api/permissions?user=:userId&resource=:resourceId

// 授予权限
POST /api/permissions
{
  "userId": "user-123",
  "resourceId": "document-456",
  "level": 3,
  "reason": "项目协作需要"
}

// 撤销权限
DELETE /api/permissions/:permissionId

// 权限历史
GET /api/permissions/:resourceId/history
```

### 安全控制 API

```typescript
// 二次确认
POST /api/confirmations
{
  "action": "delete",
  "resource": "document-123"
}

// 确认操作
POST /api/confirmations/:id/confirm

// 安全事件
GET /api/security/events

// 审计日志
GET /api/audit/logs?user=:userId&start=:startDate&end=:endDate
```

## 性能优化

### 缓存策略

**权限缓存**:
- Redis缓存用户权限
- 缓存失效机制
- 权限变更同步

**审计优化**:
- 异步日志写入
- 日志压缩存储
- 索引优化查询

### 扩展性设计

**微服务架构**:
- 权限服务独立部署
- 审计服务异步处理
- 安全服务高可用

**插件扩展**:
```typescript
interface SecurityPlugin {
  name: string;
  authenticate?: (credentials: any) => Promise<User>;
  authorize?: (user: User, resource: string, action: string) => Promise<boolean>;
  audit?: (event: AuditEvent) => Promise<void>;
}
```
