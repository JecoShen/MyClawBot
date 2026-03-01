# OpenClaw Monitor 配置说明

## config.json 配置文件

编辑 `backend/config.json` 文件设置管理员账号：

```json
{
  "adminUser": "your_username",
  "adminPass": "your_password_sha256_hash",
  "allowRegister": false
}
```

### 字段说明

| 字段 | 说明 | 示例 |
|------|------|------|
| `adminUser` | 管理员用户名 | `admin` |
| `adminPass` | 密码的 SHA256 哈希 | `5e884898da...` |
| `allowRegister` | 是否允许在线注册（已废弃） | `false` |

### 生成密码哈希

**Linux/macOS:**
```bash
echo -n "your_password" | sha256sum
# 输出：5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8
```

**在线工具:**
访问 https://sha256online.com/ 生成哈希

**示例:**
- 密码 `password` 的哈希是 `5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8`

### 完整示例

```json
{
  "adminUser": "admin",
  "adminPass": "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",
  "allowRegister": false
}
```

配置后访问面板使用：
- 用户名：`admin`
- 密码：`password`

### 修改密码

直接编辑 `config.json` 文件，修改 `adminPass` 为新的密码哈希，然后重启服务。
