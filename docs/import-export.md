# 项目导入导出与文件拖拽

## ZIP 导出

文件列表右上角的下载按钮会导出当前项目 ZIP。文件或文件夹右键选择“打包下载”会只导出所选内容；多选后右键可下载所选文件集合。

导出接口：

```http
GET /api/projects/archive?projectId=<projectId>
GET /api/projects/archive?projectId=<projectId>&paths=pages/index.zpmt&paths=assets/logo.png
```

单文件拖拽下载会优先使用浏览器 `DownloadURL` 能力：

```http
GET /api/projects/archive?projectId=<projectId>&paths=pages/index.zpmt&raw=1
```

浏览器不支持拖拽下载时，使用右键“打包下载”作为兜底。

## ZIP 导入

文件列表右上角的上传按钮用于导入 ZIP，并始终创建一个新项目。导入时需要填写项目名称和英文文件名。

导入接口：

```http
POST /api/projects/import-zip
Content-Type: multipart/form-data

file=<zip>
name=<project name>
fileName=<project file name>
```

ZIP 解包会自动去掉单一顶层目录。例如 `my-project/pages/a.zpmt` 会导入为 `pages/a.zpmt`。

## 文件上传与外部拖入

可以把本机文件或文件夹拖入文件树。拖到项目根区域会上传到根目录，拖到某个目录节点会上传到该目录，并保留拖入文件夹的相对路径。

上传接口：

```http
POST /api/projects/upload
Content-Type: multipart/form-data

projectId=<projectId>
targetPath=<folder path>
overwrite=false
files=<file[]>
paths=<relative path[]>
```

如果目标位置存在同名文件或文件夹，前端会询问覆盖、跳过或取消。跳过时只继续上传没有冲突的文件。

## 项目内拖拽移动

文件树支持多选后拖动到目录节点或根区域来移动文件位置。移动接口：

```http
PATCH /api/projects/entries/move
Content-Type: application/json

{
  "projectId": "<projectId>",
  "paths": ["pages/a.zpmt", "assets"],
  "targetPath": "archive",
  "overwrite": false
}
```

服务端会拒绝移动项目根目录，也会拒绝把目录移动到自身或子目录中。发生同名冲突时，前端同样提供覆盖、跳过或取消。

## 导入导出限制

- ZIP 文件最大 200MB。
- 解包后内容最大 500MB。
- 单次归档或导入最多 5000 个文件。
- 默认排除 `.git`、`node_modules`、`.next`、`.turbo`、`.import-*`、`.DS_Store` 和 `Thumbs.db`。
