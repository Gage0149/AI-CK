# Excel 同步版

第一次解压并将整个文件夹内的文件上传到仓库原发布位置，覆盖网页、src 和 .github/workflows/deploy.yml。使用 GitHub Actions 时，Pages 来源选 GitHub Actions。已从分支根目录发布的站点也支持这套静态文件。

日常只改 content/frame-atelier-content.xlsx。「素材」每行一条，「导航」每行一个菜单。保存后把这一个文件提交到发布用的 GitHub 分支。无需重新生成或上传网页。GitHub Pages 发布这份文件后，访客打开网页会自动读取它，已打开的标签页在前台每 30 秒检查一次。

电脑本地预览：Windows 安装 Python 3 后，双击 preview-windows.cmd 并保留打开的窗口。编辑同一文件夹里 content 下的 Excel，保存后本地预览会自动更新。本机预览仅此电脑可见。GitHub Desktop 用户可以直接编辑仓库工作目录中的 Excel，再 Commit 和 Push。

Excel 随网站公开，隐藏列和草稿工作表也可被下载。只在发布用工作簿中保存可公开的内容。
