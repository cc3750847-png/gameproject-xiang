# UI 美术资产现状清单

整理日期：2026-04-26  
用途：记录当前已收到、已可复用和仍需补齐的 UI 美术资产，方便 UI、前端和美术继续对齐。

## 1. 本轮收到的资产

| 资产 | 尺寸 | 来源路径 | 当前用途 |
| --- | --- | --- | --- |
| 开始游戏.png | 891 x 200 | `E:/CSU/社会设计/gameproject-xiang UI/控件库/新版控件库/开始游戏.png` | 入口页主按钮 |
| 继续旅程.png | 854 x 166 | `E:/CSU/社会设计/gameproject-xiang UI/控件库/新版控件库/继续旅程.png` | 入口页继续按钮 |
| 成就图鉴.png | 855 x 167 | `E:/CSU/社会设计/gameproject-xiang UI/控件库/新版控件库/成就图鉴.png` | 入口页成就入口 |
| 设置选项.png | 854 x 166 | `E:/CSU/社会设计/gameproject-xiang UI/控件库/新版控件库/设置选项.png` | 入口页设置入口 |
| 分割线.png | 375 x 27 | `E:/CSU/社会设计/gameproject-xiang UI/分割线/分割线.png` | 页面分组、标题分隔 |
| 设置.png | 103 x 106 | `E:/CSU/社会设计/gameproject-xiang UI/图标库/设置.png` | 设置入口、底部导航或弹层入口 |
| 图片.png | 101 x 106 | `E:/CSU/社会设计/gameproject-xiang UI/图标库/图片.png` | 图鉴、明信片、相册入口 |
| 退出.png | 101 x 101 | `E:/CSU/社会设计/gameproject-xiang UI/图标库/退出.png` | 退出、关闭、返回入口 |
| 地图.png | 101 x 104 | `E:/CSU/社会设计/gameproject-xiang UI/图标库/地图.png` | 地图页、底部导航 |
| 成就.png | 101 x 102 | `E:/CSU/社会设计/gameproject-xiang UI/图标库/成就.png` | 成就、终端、奖励入口 |
| 景点.png | 103 x 106 | `E:/CSU/社会设计/gameproject-xiang UI/图标库/景点.png` | 景点、节点列表、地图 marker |

## 2. 项目内已有对应版本

当前项目 `public/home` 下已经存在一套可直接被前端引用的英文命名版本：

| 项目内资产 | 尺寸 | 对应用途 |
| --- | --- | --- |
| `public/home/button-start.png` | 411 x 84 | 开始游戏 |
| `public/home/button-achievement.png` | 385 x 81 | 成就图鉴 |
| `public/home/button-settings.png` | 388 x 81 | 设置选项 |
| `public/home/divider.png` | 375 x 27 | 分割线 |
| `public/home/icon-settings.png` | 103 x 106 | 设置 |
| `public/home/icon-gallery.png` | 101 x 106 | 图片 / 图鉴 |
| `public/home/icon-exit.png` | 101 x 101 | 退出 |
| `public/home/icon-map.png` | 101 x 104 | 地图 |
| `public/home/icon-achievement.png` | 101 x 102 | 成就 |
| `public/home/icon-spot.png` | 103 x 106 | 景点 |

说明：入口按钮在源目录中是高清版本，项目内 `public/home` 目前是较小尺寸版本。前端可以先继续使用 `public/home`，如果后续首页在高分屏上发虚，再把源目录高清按钮替换进项目。

## 2.1 旅程方式选择页拆分资产

已收录一套从高保真图直接裁切的“选择旅程方式”页面资产，目录为 `public/home/mode-select/exact-split/`。这套资产用于需要与原图完全一致的前端还原；`image2.0` 拆分参考保存在 `public/home/mode-select/exact-split/source/image2-split-reference-generated.png`，最终可用 PNG 以原图像素裁切为准。

| 项目内资产 | 尺寸 | 对应用途 |
| --- | --- | --- |
| `public/home/mode-select/exact-split/assets/background-full.png` | 941 x 1672 | 选择页完整背景参考 |
| `public/home/mode-select/exact-split/assets/panel-with-content.png` | 798 x 1118 | 中央完整面板 |
| `public/home/mode-select/exact-split/assets/title-select-journey.png` | 576 x 150 | 标题“选择旅程方式” |
| `public/home/mode-select/exact-split/assets/button-single-active.png` | 635 x 200 | 单人模式选中按钮 |
| `public/home/mode-select/exact-split/assets/button-team-idle.png` | 635 x 198 | 组队模式未选中按钮 |
| `public/home/mode-select/exact-split/assets/hint-enter-main.png` | 564 x 74 | 提示文案 |
| `public/home/mode-select/exact-split/assets/divider-long.png` | 642 x 43 | 返回按钮上方分割线 |
| `public/home/mode-select/exact-split/assets/button-back-text.png` | 290 x 75 | 返回文字与装饰 |
| `public/home/mode-select/exact-split/assets/decor-maple-top-left.png` | 360 x 170 | 左上枫叶枝 |
| `public/home/mode-select/exact-split/assets/decor-right-maple.png` | 138 x 104 | 右侧枫叶与边框局部 |
| `public/home/mode-select/exact-split/assets/decor-bottom-mountains.png` | 941 x 342 | 底部山水淡彩 |
| `public/home/mode-select/exact-split/assets/decor-bottom-right-leaves.png` | 188 x 235 | 右下山水与枫叶 |

清单文件：`public/home/mode-select/exact-split/mode-select-exact-manifest.json`。预览图：`public/home/mode-select/exact-split/mode-select-exact-preview.jpg`。

## 3. 这些资产能支撑的页面

| 页面 | 覆盖情况 | 说明 |
| --- | --- | --- |
| 入口页 / 旅程方式选择页 | 基本覆盖 | 开始游戏、继续旅程、成就图鉴、设置选项、分割线，以及旅程方式选择页面板、按钮、标题和装饰都已具备 |
| 地图页 | 部分覆盖 | 已有地图、景点图标；还缺八关独立节点图标和路线底图 |
| 节点详情页 | 部分覆盖 | 可用景点图标做通用占位；还缺每个节点的专属图标和奖励预览 |
| 节点任务页 | 少量覆盖 | 可复用退出、景点、成就图标；还缺任务类型图标和完成反馈 |
| AR 引导页 | 未覆盖核心 | 已有退出图标；还缺扫描框、锁定框、粒子引导 |
| 角色页 | 未覆盖核心 | 还缺镇江者、拾遗者、燃火者三身份头像或徽章 |
| 终端页 | 部分覆盖 | 已有成就、图片、设置图标；还缺明信片缩略图模板和成就徽章 |
| 结算页 | 未覆盖核心 | 还缺终章海报模板、三身份结局背景、分享边框 |

## 4. 当前仍需补齐的 P1 资产

优先补这几组，前端页面就能继续推进：

1. 三身份头像 / 徽章：镇江者、拾遗者、燃火者。
2. 八关节点图标：1925·觉醒、沁园·挥毫、朱张·问学、天问·觉醒、百工·传承、百虹·镇守、拱极·守望、湘君·鼓瑟。
3. 状态小图标：定位中、可进入、不可进入、已完成、已跳过、错误 / 权限失败。
4. 奖励图标：明信片、文脉碎片、火种 / 灵韵、称号、非遗徽章、镇江徽记。
5. AR HUD：扫描框四角、扫描线、目标锁定、信号丢失、粒子引导母题。

## 5. 暂可后置的资产

- 终章分享海报模板。
- 三身份结局大背景。
- 节点完成页强化插画。
- 解锁下一节点动效序列。
- 可兑换权益入口卡图。

这些资产影响最终质感和传播效果，但不应卡住当前页面结构、状态流和前端拆分。
