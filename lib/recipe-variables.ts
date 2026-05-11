export type Locale = 'zh' | 'en'
export type LocalizedText = Record<Locale, string>
export type RecipeVariableScope = 'system' | 'personal' | 'community'

export type RecipeVariableChangeLog = {
  version: string
  date: string
  note: LocalizedText
}

export type RecipeVariableItem = {
  id: string
  sourceId?: string
  sourceFilePath?: string
  scope: RecipeVariableScope
  variableName: string
  name: LocalizedText
  description: LocalizedText
  content: LocalizedText
  candidates: Record<Locale, string[]>
  defaultValues: string[]
  multiple: boolean
  createdAt?: string
  updatedAt?: string
  changeLog: RecipeVariableChangeLog[]
}

export type RecipeVariableCategory = {
  id: string
  scope: RecipeVariableScope
  icon: string
  name: LocalizedText
  description: LocalizedText
  tip: LocalizedText
  createdAt?: string
  updatedAt?: string
  changeLog: RecipeVariableChangeLog[]
  variables: RecipeVariableItem[]
}

export type RecipeVariableStats = Record<RecipeVariableScope, number>

export type RecipeVariableSnapshot = {
  tokenName: string
  sourceId: string
  sourceFilePath?: string
  scope: RecipeVariableScope
  id: string
  categoryId: string
  categoryName: LocalizedText
  variableName: string
  name: LocalizedText
  description: LocalizedText
  content: LocalizedText
  candidates: Record<Locale, string[]>
  defaultValues: string[]
  multiple: boolean
  updatedAt?: string
  changeLog: RecipeVariableChangeLog[]
}

export type ZpmtRecipeVariableMetadata = {
  schemaVersion: 2
  recipeVariables: RecipeVariableSnapshot[]
}

const SYSTEM_UPDATED_AT = '2026-05-11T00:00:00.000Z'
const COMMUNITY_UPDATED_AT = '2026-05-09T00:00:00.000Z'

export const SYSTEM_RECIPE_VARIABLE_CATEGORIES: RecipeVariableCategory[] = [
  createSystemCategory({
    id: 'camera',
    icon: 'aperture',
    name: ['镜头语言', 'Camera Language'],
    description: ['图片生成中的视角、镜头、景别和画幅控制。', 'Perspective, lens, shot scale, and aspect controls for image generation.'],
    tip: ['用于搭建图片提示词的视觉骨架。', 'Use as the visual base for image prompts.'],
    variables: [
      createSystemVariable({
        id: 'focal-length',
        variableName: 'focalLength',
        name: ['焦段', 'Focal length'],
        description: ['控制画面透视和空间压缩程度。', 'Controls perspective and spatial compression.'],
        content: ['摄影镜头焦段，用于决定广角、标准、人像或长焦压缩效果。', 'Camera focal length for wide, standard, portrait, or telephoto compression.'],
        candidates: ['14mm 超广角', '18mm', '24mm', '28mm', '35mm', '50mm', '70mm', '85mm', '100mm 微距', '135mm', '200mm 长焦'],
        defaultValues: ['35mm'],
        multiple: false,
      }),
      createSystemVariable({
        id: 'lens-type',
        variableName: 'lensType',
        name: ['镜头类型', 'Lens type'],
        description: ['定义镜头特性和画面畸变倾向。', 'Defines lens character and distortion tendency.'],
        content: ['镜头类型，如广角、定焦、电影镜头、微距或航拍镜头。', 'Lens type, such as wide-angle, prime, cinema, macro, or aerial lens.'],
        candidates: ['广角镜头', '标准定焦', '人像定焦', '长焦镜头', '微距镜头', '鱼眼镜头', '移轴镜头', '电影镜头', '手机镜头', '航拍镜头', '针孔镜头', '变焦镜头'],
        defaultValues: ['定焦镜头'],
        multiple: false,
      }),
      createSystemVariable({
        id: 'shot-size',
        variableName: 'shotSize',
        name: ['景别', 'Shot size'],
        description: ['定义主体在画面中的占比。', 'Defines how much space the subject occupies in frame.'],
        content: ['景别设置，如特写、中景、全身像、远景或产品近景。', 'Framing scale, such as close-up, medium shot, full-body, wide shot, or product close-up.'],
        candidates: ['大特写', '特写', '半身像', '中景', '全身像', '远景', '大全景', '俯拍全景', '产品近景', '环境肖像', '细节切片', '建立镜头'],
        defaultValues: ['中景'],
        multiple: false,
      }),
      createSystemVariable({
        id: 'camera-angle',
        variableName: 'cameraAngle',
        name: ['拍摄角度', 'Camera angle'],
        description: ['控制视角高度、方向和观看关系。', 'Controls camera height, direction, and viewer relationship.'],
        content: ['拍摄角度，如正面视角、俯拍、仰拍、侧面或过肩视角。', 'Camera angle, such as front view, overhead, low angle, side view, or over-the-shoulder.'],
        candidates: ['正面视角', '侧面视角', '三分之四视角', '俯拍', '仰拍', '鸟瞰视角', '低角度视角', '过肩视角', '背影视角', '近距离平视', '斜侧视角', '第一人称视角'],
        defaultValues: ['正面视角'],
        multiple: false,
      }),
      createSystemVariable({
        id: 'image-aspect-ratio',
        variableName: 'imageAspectRatio',
        name: ['画幅比例', 'Aspect ratio'],
        description: ['控制图片输出构图比例和适配平台。', 'Controls output framing ratio and platform fit.'],
        content: ['画幅比例，如 1:1 方图、16:9 横版、9:16 竖版或 3:4 人像。', 'Aspect ratio, such as 1:1 square, 16:9 landscape, 9:16 vertical, or 3:4 portrait.'],
        candidates: ['1:1 方图', '4:5 社媒竖图', '3:4 人像竖图', '2:3 海报竖图', '9:16 手机竖屏', '16:9 横版', '3:2 摄影横图', '21:9 电影宽屏', '5:4 产品图', 'A4 竖版'],
        defaultValues: ['1:1 方图'],
        multiple: false,
      }),
    ],
  }),
  createSystemCategory({
    id: 'visual-style',
    icon: 'palette',
    name: ['视觉风格', 'Visual Style'],
    description: ['图片生成中的光线、色调、构图、风格和渲染方法。', 'Lighting, tone, composition, style, and rendering method for image generation.'],
    tip: ['候选项优先参考 ZrImgs 高频提示词，并补足常用图片生成控制项。', 'Candidates prioritize frequent ZrImgs prompt patterns and add common image controls.'],
    variables: [
      createSystemVariable({
        id: 'lighting',
        variableName: 'lighting',
        name: ['光线', 'Lighting'],
        description: ['控制光源类型和明暗关系。', 'Controls light source and contrast relationship.'],
        content: ['画面光线类型，可组合自然光、黄金时刻、体积光、逆光和霓虹光。', 'Lighting style, combining natural light, golden hour, volumetric light, backlight, and neon light.'],
        candidates: ['黄金时刻', '霓虹灯光', '体积光', '自然光', '轮廓光', '逆光', '柔和光', '侧光', '顶光', '高对比光影', '蓝调时刻', '工作室布光', '伦勃朗光', '低调光', '窗边光', '散射光', '硬光阴影', '舞台追光'],
        defaultValues: ['自然光'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'color-tone',
        variableName: 'colorTone',
        name: ['色调', 'Color tone'],
        description: ['定义整体颜色温度和饱和倾向。', 'Defines overall color temperature and saturation tendency.'],
        content: ['整体色调方向，如暖色调、冷色调、低饱和、复古胶片色或黑金配色。', 'Overall tone direction, such as warm, cool, low saturation, film color, or black-and-gold palette.'],
        candidates: ['暖色调', '冷色调', '低饱和', '高饱和', '复古胶片色', '清新明亮', '粉彩色', '单色调', '黑金配色', '莫兰迪色', '赛博霓虹色', '暗黑氛围', '高端灰', '糖果色', '自然大地色', '青橙电影色', '品牌主色突出'],
        defaultValues: ['暖色调'],
        multiple: false,
      }),
      createSystemVariable({
        id: 'composition',
        variableName: 'composition',
        name: ['构图', 'Composition'],
        description: ['约束主体、空间和视觉动线。', 'Constrains subject placement, space, and visual flow.'],
        content: ['构图方式，可组合层次分明、留白、对称、前景遮挡和视觉引导线。', 'Composition style combining layered depth, negative space, symmetry, foreground framing, and leading lines.'],
        candidates: ['层次分明', '留白构图', '对称构图', '前景遮挡', '背景虚化', '低角度构图', '居中构图', '视觉引导线', '主体突出', '对角线构图', '三分法构图', '框中框构图', '密集排版构图', '极简构图', '开放式构图', '海报式中心构图'],
        defaultValues: ['三分法构图'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'visual-style-direction',
        variableName: 'visualStyle',
        name: ['画面风格', 'Visual style'],
        description: ['定义图片的整体画风、媒介和视觉参考方向。', 'Defines the overall art direction, medium, and visual reference.'],
        content: ['画面风格，如电影海报、写实摄影、二次元、插画风、3D 渲染或国风。', 'Visual style, such as cinematic poster, realistic photography, anime, illustration, 3D render, or Chinese style.'],
        candidates: ['电影海报', '写实摄影', '二次元', '插画风', '3D渲染', '赛博朋克', '国风', '油画', '高级时尚', '水彩', '极简主义', '商业海报', '科幻概念', '低多边形', '梦幻童话', '像素艺术', '蒸汽波', '黏土风', '扁平矢量', '儿童绘本', '暗黑奇幻', '产品广告大片'],
        defaultValues: ['写实摄影'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'render-method',
        variableName: 'renderMethod',
        name: ['渲染方式', 'Render method'],
        description: ['定义图片的摄影、引擎、材质或后期处理方法。', 'Defines photography, engine, material, or post-processing method.'],
        content: ['渲染方式，如 HDR、真实摄影、Unreal Engine、PBR 材质或胶片质感。', 'Render method, such as HDR, real photography, Unreal Engine, PBR material, or film texture.'],
        candidates: ['HDR', 'Unreal Engine', '真实摄影', '胶片质感', '高动态范围', 'PBR材质', 'Blender', 'Octane Render', '产品级渲染', '后期精修', '景深渲染', 'Cycles渲染', '全局光照', '路径追踪', '手绘笔触', '矢量渲染'],
        defaultValues: ['真实摄影'],
        multiple: true,
      }),
    ],
  }),
  createSystemCategory({
    id: 'subject',
    icon: 'user-round',
    name: ['主体设定', 'Subject Setup'],
    description: ['图片主体、动作状态、材质、细节和情绪氛围。', 'Image subject, action state, material, detail, and mood presets.'],
    tip: ['适合角色、产品、场景和商业图片生成复用。', 'Reusable across character, product, scene, and commercial image generation.'],
    variables: [
      createSystemVariable({
        id: 'subject-type',
        variableName: 'subjectType',
        name: ['主体类型', 'Subject type'],
        description: ['图片中最主要的对象、角色或产品类型。', 'The main object, role, or product type in the image.'],
        content: ['主体类型，如男性角色、女性角色、人物肖像、产品主体、食品饮品或建筑。', 'Subject type, such as male character, female character, portrait, product, food and drink, or architecture.'],
        candidates: ['男性角色', '女性角色', '人物肖像', '产品主体', '食品饮品', '建筑', '猫', '狗', '儿童', '车辆', '动物', '机器人', '情侣', '鸟类', '奇幻生物', '团队合影', '植物花卉', '虚拟主播', 'IP吉祥物', '家居物件', '服装穿搭', '电子设备'],
        defaultValues: ['人物肖像'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'pose',
        variableName: 'pose',
        name: ['主体姿态', 'Subject pose'],
        description: ['控制主体动作和身体状态。', 'Controls subject action and body state.'],
        content: ['主体姿态，如微笑、站立、悬浮、坐姿、回眸、奔跑或展示产品。', 'Subject pose, such as smiling, standing, floating, seated, looking back, running, or presenting a product.'],
        candidates: ['微笑', '站立', '悬浮', '坐姿', '回眸', '奔跑', '战斗姿态', '手持物品', '展示产品', '动态瞬间', '互动交流', '静物摆放', '凝视镜头', '舞台表演', '优雅姿态', '跳跃', '行走', '低头沉思', '转身瞬间', '使用设备'],
        defaultValues: ['站立'],
        multiple: false,
      }),
      createSystemVariable({
        id: 'material',
        variableName: 'material',
        name: ['材质风格', 'Material style'],
        description: ['描述主体或关键物件的材质表现。', 'Describes material rendering for the subject or key objects.'],
        content: ['材质风格，可组合织物、玻璃、金属、皮革、皮肤质感、塑料或水晶。', 'Material style, combining fabric, glass, metal, leather, skin texture, plastic, or crystal.'],
        candidates: ['织物', '玻璃', '金属', '皮革', '皮肤质感', '塑料', '丝绸', '纸张', '水晶', '水面', '烟雾', '毛发', '石材', '陶瓷', '木材', '珠宝光泽', '橡胶', '亚克力', '哑光涂层', '拉丝金属'],
        defaultValues: ['织物'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'mood',
        variableName: 'mood',
        name: ['情绪氛围', 'Mood'],
        description: ['控制画面情绪和叙事气质。', 'Controls mood and narrative atmosphere.'],
        content: ['情绪氛围，可组合夜晚、安静、神秘、清晨、梦幻、黄昏或高级感。', 'Mood, combining night, quiet, mysterious, morning, dreamlike, dusk, or premium atmosphere.'],
        candidates: ['夜晚', '安静', '神秘', '清晨', '梦幻', '黄昏', '高级感', '温馨', '未来感', '雨天', '节日氛围', '热闹', '雪景', '复古感', '商业大片氛围', '雾气弥漫', '孤独感', '治愈感', '紧张感', '史诗感'],
        defaultValues: ['梦幻'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'detail-level',
        variableName: 'detailLevel',
        name: ['细节增强', 'Detail enhancement'],
        description: ['用于提升画面精细程度、质感和局部表现。', 'Improves image detail, texture, and local expression.'],
        content: ['细节增强，如层次丰富、高级质感、丰富细节、细腻皮肤或精密结构。', 'Detail enhancement, such as rich layers, premium texture, rich detail, delicate skin, or precise structure.'],
        candidates: ['层次丰富', '高级质感', '丰富细节', '复杂装饰', '细腻皮肤', '精密结构', '干净轮廓', '高光点缀', '精致纹理', '清晰边缘', '微小颗粒', '真实反射', '自然瑕疵', '手工痕迹', '产品倒角清晰'],
        defaultValues: ['高级质感'],
        multiple: true,
      }),
    ],
  }),
  createSystemCategory({
    id: 'image-output',
    icon: 'boxes',
    name: ['图片输出', 'Image Output'],
    description: ['图片生成的场景、用途、质量和负面约束。', 'Scene, use case, quality, and negative constraints for image generation.'],
    tip: ['用于把图片提示词从风格描述补全到可交付成片标准。', 'Completes image prompts from style direction to deliverable output standards.'],
    variables: [
      createSystemVariable({
        id: 'scene-type',
        variableName: 'sceneType',
        name: ['场景类型', 'Scene type'],
        description: ['主体所在的主要空间、背景或环境类型。', 'The main space, background, or environment where the subject appears.'],
        content: ['场景类型，如自然风景、室内空间、城市街景、商业棚拍或未来城市。', 'Scene type, such as natural landscape, interior, city street, commercial studio, or future city.'],
        candidates: ['自然风景', '室内空间', '城市街景', '商业棚拍', '卧室', '办公室', '厨房', '未来城市', '花园', '森林', '咖啡馆', '海边', '山脉', '舞台', '展厅', '赛博朋克街区', '宇宙星空', '校园', '工厂车间', '美术馆', '街头夜市', '豪华酒店'],
        defaultValues: ['室内空间'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'design-use',
        variableName: 'designUse',
        name: ['设计用途', 'Design use'],
        description: ['生成图片面向的业务、展示或发布场景。', 'Business, display, or publishing scenario for the generated image.'],
        content: ['设计用途，如海报、头像、壁纸、封面图、品牌视觉或电商主图。', 'Design use, such as poster, avatar, wallpaper, cover, brand visual, or ecommerce hero image.'],
        candidates: ['海报', '头像', '壁纸', '封面图', '品牌视觉', '活动宣传图', '电商主图', '角色设定图', '概念设计', '产品展示图', '故事插画', '广告图', '社交媒体配图', '小红书封面', '公众号首图', 'APP启动页', '商品详情图', 'PPT封面'],
        defaultValues: ['海报'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'image-quality',
        variableName: 'imageQuality',
        name: ['质量描述', 'Image quality'],
        description: ['生成结果需要达到的清晰度、完成度和专业标准。', 'Target clarity, completeness, and production quality.'],
        content: ['质量描述，如高质量、8K、超清、细节丰富、无水印或专业摄影。', 'Quality description, such as high quality, 8K, ultra clear, rich detail, no watermark, or professional photography.'],
        candidates: ['高质量', '8K', '超清', '细节丰富', '无水印', '专业摄影', '干净背景', '真实质感', '大师级作品', '全局光照', '电影级调色', '锐利对焦', '高端质感', '精细渲染', '商业成片', '清晰主体', '低噪点', '自然皮肤质感'],
        defaultValues: ['高质量'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'negative-quality',
        variableName: 'negativeQuality',
        name: ['负面约束', 'Negative constraints'],
        description: ['不希望出现在画面中的低质量表现或干扰元素。', 'Low-quality artifacts or unwanted elements to avoid.'],
        content: ['负面约束，如模糊、水印、logo、边框、噪点、畸变或文字错误。', 'Negative constraints, such as blur, watermark, logo, frame, noise, distortion, or text errors.'],
        candidates: ['logo', '模糊', '水印', '边框', '噪点', '低清晰度', '过曝', '低质量', '畸变', '比例错误', '多余手指', '文字错误', '裁切主体', '欠曝', '手部错误', '压缩伪影', '重复主体', '脸部崩坏', '错误透视', '杂乱背景', '不自然皮肤', '过度锐化'],
        defaultValues: ['模糊', '水印', '低质量'],
        multiple: true,
      }),
    ],
  }),
  createSystemCategory({
    id: 'visual-structure',
    icon: 'boxes',
    name: ['视觉结构', 'Visual Structure'],
    description: ['从本地提示词样本人工提炼的海报骨架、叙事载体和印刷质感。', 'Manually distilled poster skeletons, narrative carriers, and print textures from local prompts.'],
    tip: ['适合收藏版海报、国潮城市海报、轮廓宇宙、双重曝光和纸张质感类模板。', 'Useful for collectible posters, city posters, outline universes, double exposure, and paper texture templates.'],
    variables: [
      createSystemVariable({
        id: 'narrative-carrier',
        variableName: 'narrativeCarrier',
        name: ['叙事载体', 'Narrative carrier'],
        description: ['定义承载完整画面叙事的主轮廓、主结构或主视觉容器。', 'Defines the main outline, structure, or visual carrier that holds the image story.'],
        content: ['叙事载体，如人物侧脸剪影、轮廓宇宙、S 形撕纸裂口、绸带河流或字体主视觉。', 'Narrative carrier such as side-face silhouette, outline universe, S-shaped paper tear, ribbon river, or text-led key visual.'],
        candidates: ['人物侧脸剪影', '主题轮廓宇宙', '巨型头部剪影', 'S形绸带河流', 'S形撕纸裂口', '字体主视觉', '卡牌式版面', '地图式世界观', '分镜联络单', '圆角信息卡', '巨大精神象征背景', '桥梁行走动线', '舞台框景', '拱门/王座/塔楼轮廓', '眼睛/手掌/面具轮廓', '空间切面结构'],
        defaultValues: ['主题轮廓宇宙'],
        multiple: false,
      }),
      createSystemVariable({
        id: 'inner-world-composition',
        variableName: 'innerWorldComposition',
        name: ['内部世界组织', 'Inner world composition'],
        description: ['控制双重曝光、剪影填充和轮廓内部叙事元素的组织方式。', 'Controls how narrative elements are organized inside double exposure or silhouette structures.'],
        content: ['内部世界组织，如标志性场景、核心建筑、角色关系、象征符号和远中近景递进。', 'Inner world composition such as iconic scenes, core buildings, character relationships, symbols, and depth progression.'],
        candidates: ['标志性场景', '核心建筑', '角色关系', '象征符号', '文明痕迹', '远中近景递进', '门洞台阶桥梁路径', '水面倒影烟雾', '小比例人物剪影', '自然生长于轮廓', '叙事拼贴但不杂乱', '内部场景通透过渡', '主体外轮廓清晰', '边界处融合世界观', '前景中景背景分层', '命运感光源'],
        defaultValues: ['标志性场景', '远中近景递进'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'print-texture',
        variableName: 'printTexture',
        name: ['纸张印刷质感', 'Print texture'],
        description: ['控制纸张、手工、印刷、水彩和旧照片质感。', 'Controls paper, handmade, print, watercolor, and vintage photo textures.'],
        content: ['纸张印刷质感，如纸张颗粒、边缘飞白、水彩刷痕、旧宣纸或胶片划痕。', 'Print texture such as paper grain, dry brush edges, watercolor strokes, aged rice paper, or film scratches.'],
        candidates: ['纸张颗粒', '边缘飞白', '水彩刷痕', '轻微晕染', '旧宣纸', '胶片颗粒', '泛黄褪色', '密集划痕', '水渍斑驳', '拍立得边框', '胶带拼贴', '手写感标题', '墨迹晕染', '撕纸浮雕', '红色印章', '低饱和印刷质感', 'Behance风格设定板', 'ArtStation风格设定板'],
        defaultValues: ['纸张颗粒', '边缘飞白'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'poster-hierarchy',
        variableName: 'posterHierarchy',
        name: ['海报层级', 'Poster hierarchy'],
        description: ['定义海报中第一主体、第二主体、标题区和留白之间的层级关系。', 'Defines hierarchy among the primary subject, secondary subject, title area, and whitespace.'],
        content: ['海报层级，如上大下小、巨型轮廓加完整人物、标题区低调或大面积留白。', 'Poster hierarchy such as large-over-small, giant outline plus full body, quiet title area, or large whitespace.'],
        candidates: ['上大下小层级', '巨型轮廓第一主体', '完整人物第二主体', '标题区低调清晰', '大面积留白', '中心纪念碑构图', '主视觉最强', '边缘虚化破碎', '内部细节不拥挤', '左右辅景呼应', '底部署名/印章', '左下角宣传标题', '竖排题字装饰', '卡片信息分区', '主图与缩略图层级'],
        defaultValues: ['主视觉最强', '大面积留白'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'double-exposure-fusion',
        variableName: 'doubleExposureFusion',
        name: ['双曝融合方式', 'Double exposure fusion'],
        description: ['控制双重曝光、剪影填充、拼贴叙事和图像边界的融合方式。', 'Controls double exposure, silhouette fills, narrative collage, and image-boundary blending.'],
        content: ['双曝融合方式，如轮廓内部生长、边界雾化过渡、主体与世界观互相嵌套。', 'Double exposure fusion such as growing inside the outline, feathered boundary transitions, and subject-world nesting.'],
        candidates: ['轮廓内部生长', '边界雾化过渡', '主体与世界观互相嵌套', '双重曝光联想', '剪影填充式叙事', '拼贴但不硬裁切', '水墨云雾衔接', '水彩晕染过渡', '内部元素低调缠绕', '外轮廓保持清晰', '主体局部与场景融合', '符号沿边界生长', '前中后景通透叠加', '局部体积光穿透', '不要素材堆叠', '不要普通背景拼接'],
        defaultValues: ['轮廓内部生长', '边界雾化过渡', '外轮廓保持清晰'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'visual-flow-whitespace',
        variableName: 'visualFlowWhitespace',
        name: ['动线与留白', 'Visual flow and whitespace'],
        description: ['控制画面中路径、曲线、视线引导和留白呼吸感。', 'Controls paths, curves, eye direction, and breathing room in the composition.'],
        content: ['动线与留白，如 S 形流动、桥梁行走动线、左下标题区和大面积白色虚空。', 'Visual flow and whitespace such as S-curves, bridge walking paths, lower-left title zones, and large white voids.'],
        candidates: ['S形流动感', '桥梁行走动线', '丝带变河流', '撕纸裂口引导', '垂直上升动线', '横向史诗延展', '对角线推进', '中心纪念碑稳定', '左下标题安全区', '底部落款安全区', '大面积白色虚空', '边缘呼吸感', '视线从主体走向背景象征', '小人物放大空间尺度', '留出下一层内容暗示', '不要平均铺满'],
        defaultValues: ['S形流动感', '大面积白色虚空', '边缘呼吸感'],
        multiple: true,
      }),
    ],
  }),
  createSystemCategory({
    id: 'portrait-identity',
    icon: 'user-round',
    name: ['人像身份与分析', 'Portrait Identity and Analysis'],
    description: ['从人像报告、试戴、换装和身份保真样本中人工提炼的控制变量。', 'Manually distilled controls for portrait reports, try-ons, styling, and identity preservation.'],
    tip: ['适合参考图人像、眼镜搭配、个人色彩分析、真人化 Cosplay 和 Lookbook 模板。', 'Useful for reference portraits, glasses guides, color analysis, realistic cosplay, and lookbook templates.'],
    variables: [
      createSystemVariable({
        id: 'identity-lock-policy',
        variableName: 'identityLockPolicy',
        name: ['身份保真策略', 'Identity lock policy'],
        description: ['约束生成结果如何保留上传人像或角色参考的身份识别点。', 'Constrains how outputs preserve the uploaded portrait or character identity cues.'],
        content: ['身份保真策略，如唯一身份锚点、保留五官比例、忽略背景人物和多图同一张脸。', 'Identity policy such as single identity anchor, preserve facial proportions, ignore background people, and same face across panels.'],
        candidates: ['唯一身份锚点', '保留脸部辨识度', '保留五官比例', '保留脸型轮廓', '保留肤色与真实气质', '忽略背景人物', '辅助图只校正身份', '多图保持同一张脸', '不要网红脸', '不要借用商品图模特', '自然重建头颈肩关系', '不硬贴原图头部姿势', '只改变服装/配饰/场景', '主角色必须最大最清晰', '剔除镜面反射人物'],
        defaultValues: ['唯一身份锚点', '保留脸部辨识度', '多图保持同一张脸'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'portrait-report-type',
        variableName: 'portraitReportType',
        name: ['人像报告类型', 'Portrait report type'],
        description: ['指定人像类图卡、报告或试穿试戴任务的产物类型。', 'Specifies the output type for portrait cards, reports, styling, or try-on tasks.'],
        content: ['人像报告类型，如面部特征分析、眼镜搭配指南、个人色彩分析或身份保真换装。', 'Portrait report type such as face feature analysis, glasses guide, personal color analysis, or identity-preserving styling.'],
        candidates: ['面部特征分析', '眼镜搭配指南', '个人色彩分析报告', '上身颜色对比', '专属色盘', '妆容发色建议', 'Lookbook穿搭', '身份保真换装', '角色真人化封面', '参考图角色一致性', '适合/不适合对比', 'Before/Hero After 对比', '形象顾问报告', '社群分享图卡'],
        defaultValues: ['个人色彩分析报告'],
        multiple: false,
      }),
      createSystemVariable({
        id: 'portrait-analysis-focus',
        variableName: 'portraitAnalysisFocus',
        name: ['人像分析维度', 'Portrait analysis focus'],
        description: ['定义人像分析时需要识别、对比或展示的关键维度。', 'Defines key dimensions to detect, compare, or display in portrait analysis.'],
        content: ['人像分析维度，如脸型、眼睛、眉毛、肤色冷暖、面部对比度、气质关键词或镜框适配。', 'Portrait analysis dimensions such as face shape, eyes, eyebrows, undertone, contrast, vibe keywords, or frame fit.'],
        candidates: ['脸型', '眼睛', '眉毛', '鼻子', '脸颊', '嘴唇', '肤色冷暖', '肤色明度', '发色', '瞳色', '面部对比度', '气质关键词', '色彩季型', '显白颜色', '提气色颜色', '最显高级颜色', '镜框适配', '眉眼距离', '鼻梁高度', '脸宽比例'],
        defaultValues: ['脸型', '眼睛', '肤色冷暖', '面部对比度'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'comparison-labels',
        variableName: 'comparisonLabels',
        name: ['对比标签', 'Comparison labels'],
        description: ['用于对比报告、试穿、试戴和推荐卡片的短标签体系。', 'Short label system for comparison reports, try-ons, and recommendation cards.'],
        content: ['对比标签，如最适合、普通、不建议、推荐、避免、提亮肤色或显暗沉。', 'Comparison labels such as best, ordinary, avoid, recommended, brightens skin, or dulls complexion.'],
        candidates: ['最适合', '普通', '不建议', '推荐', '避免', '提亮肤色', '显暗沉', '显白', '显疲惫', '显高级', '修饰脸型', '压低眉眼', 'Before', 'Hero After', 'Lookbook thumbnails', '适合', '不适合', '推荐色', '避免色'],
        defaultValues: ['最适合', '普通', '不建议'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'reference-image-role',
        variableName: 'referenceImageRole',
        name: ['参考图角色', 'Reference image role'],
        description: ['定义多张参考图各自用于身份、风格、商品或辅助校正的边界。', 'Defines how each reference image is used for identity, style, product, or auxiliary correction.'],
        content: ['参考图角色，如 Image 1 唯一身份基准、辅助图只校正光线角度、商品图不能借脸。', 'Reference image roles such as Image 1 as the only identity anchor, auxiliary images only for correction, and product images never donating faces.'],
        candidates: ['Image 1 唯一身份基准', '只识别最大最清晰主角色', '忽略背景路人', '忽略镜面反射人物', '辅助图只校正光线角度', '辅助图只校正身形发型', '冲突时以主图为准', '商品图不能借脸', '风格图不能借妆容', 'Before 只能使用本人', '多宫格同一张脸', '减少小头像保证身份一致', '参考图不作为新模特来源', '允许自然重建姿态', '保持脸型发际线眉眼距离'],
        defaultValues: ['Image 1 唯一身份基准', '辅助图只校正光线角度', '多宫格同一张脸'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'color-analysis-result-policy',
        variableName: 'colorAnalysisResultPolicy',
        name: ['色彩分析结果策略', 'Color analysis result policy'],
        description: ['控制个人色彩报告是重新分析、结果可视化，还是按用户确认结论排版。', 'Controls whether a personal color report analyzes, visualizes a confirmed result, or layouts user-provided conclusions.'],
        content: ['色彩分析结果策略，如结果可视化、不要重新判断、展示季型、显白 Top5 和妆发饰品建议。', 'Color analysis policy such as visualize confirmed results, do not re-judge, show season type, top colors, makeup, hair, and accessories.'],
        candidates: ['结果可视化', '不要重新判断', '严格按已确认结果', '自动分析但标注维度', '展示个人季型', '冷暖明度饱和度', '肤色/发色/瞳色', '面部对比度', '气质关键词', '最显白Top5', '最提气色Top5', '最显高级Top5', '推荐/普通/避免色', '妆容色彩建议', '发色方向建议', '饰品材质建议', '穿搭配色方向'],
        defaultValues: ['结果可视化', '展示个人季型', '推荐/普通/避免色'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'tryon-display-policy',
        variableName: 'tryonDisplayPolicy',
        name: ['试穿试戴展示策略', 'Try-on display policy'],
        description: ['控制服装颜色、眼镜、配饰或 Lookbook 多图展示时的身份一致和对比方式。', 'Controls identity consistency and comparison layouts for outfit colors, glasses, accessories, or lookbook displays.'],
        content: ['试穿试戴展示策略，如同一张脸并排对比、只改变衣服颜色、眼镜贴合透视。', 'Try-on display policy such as same-face side-by-side comparison, change only garment color, and glasses aligned to face perspective.'],
        candidates: ['同一张脸并排对比', '只改变衣服颜色', '只改变眼镜款式', '只改变配饰场景', '眼镜贴合鼻梁耳部', '服装与颈肩自然连接', '头颈肩关系协调', '不要硬贴原图头部', '不要相似模特替换', '推荐/避免分组清楚', 'Before/Hero After 层级', 'Lookbook缩略图一致', '小图身份不稳则减少数量', '自然姿态但身份不变', '佩戴效果真实可信'],
        defaultValues: ['同一张脸并排对比', '只改变衣服颜色', '头颈肩关系协调'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'character-realism-translation',
        variableName: 'characterRealismTranslation',
        name: ['角色真人化转译', 'Character realism translation'],
        description: ['控制动漫、游戏或 IP 角色真人化时如何保留识别点并转为高级真实质感。', 'Controls how anime, game, or IP characters preserve identity cues while becoming premium realistic imagery.'],
        content: ['角色真人化转译，如原作识别特征、真实皮肤、沙龙发型、高定服装和世界观环境绑定。', 'Character realism translation such as original identity cues, real skin, salon hair, couture outfit, and lore-bound environment.'],
        candidates: ['保留原作识别特征', '真实人类皮肤质感', '不过度磨皮', '高端沙龙发型', '发丝符合真实重力', '服装高级定制转译', '保留标志性配色', '保留饰品与道具', '世界观环境强绑定', '高预算电影布景', '浅景深散景', '克制商业摄影张力', '高级写真出道氛围', '避免廉价Cosplay', '避免假发塑料感', '避免无关玄幻背景'],
        defaultValues: ['保留原作识别特征', '真实人类皮肤质感', '服装高级定制转译'],
        multiple: true,
      }),
    ],
  }),
  createSystemCategory({
    id: 'infographic-design',
    icon: 'boxes',
    name: ['信息图版式', 'Infographic Layout'],
    description: ['信息图、报告页、分镜设定板和图卡的版式控制。', 'Layout controls for infographics, report pages, storyboard boards, and cards.'],
    tip: ['适合面部分析、眼镜搭配、色彩分析、电影分镜信息图和产品参数图。', 'Useful for face analysis, glasses guides, color analysis, film storyboard boards, and product infographics.'],
    variables: [
      createSystemVariable({
        id: 'infographic-layout',
        variableName: 'infographicLayout',
        name: ['信息图布局', 'Infographic layout'],
        description: ['定义信息图使用的卡片、箭头、网格、对比和报告页结构。', 'Defines cards, arrows, grids, comparisons, and report page structures for infographics.'],
        content: ['信息图布局，如圆角信息卡、细箭头标注、并排对比、色板矩阵或分区网格。', 'Infographic layout such as rounded cards, thin arrows, side-by-side comparison, color palette matrix, or section grid.'],
        candidates: ['圆角信息卡', '细箭头标注', '并排对比', '色板矩阵', '分区网格', '竖版报告页', '杂志封面网格', '角色设计区', '场景设计区', '俯视镜头调度图', '3x3联络单', '4x3关键帧表', '8镜头分镜区', '左图右卡片', '中心人像环绕标注', '标题栏分区', '图标+短标签'],
        defaultValues: ['圆角信息卡', '分区网格'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'text-clarity-policy',
        variableName: 'textClarityPolicy',
        name: ['文字清晰策略', 'Text clarity policy'],
        description: ['控制图片中文字的数量、大小、可读性和替代方式。', 'Controls amount, size, readability, and alternatives for text inside images.'],
        content: ['文字清晰策略，如只保留短标签、大号清晰文字、小字用图标或色块替代。', 'Text clarity policy such as short labels only, large readable text, and replacing small text with icons or swatches.'],
        candidates: ['只保留短标签', '大号清晰文字', '每行不超过8个汉字', '不要长段正文', '小字用图标替代', '小字用色块替代', '标题必须可读', '中文准确无乱码', '英文拼写准确', '文字不遮挡主体', '少量关键信息', '不要密集多行小字', '卡片文字最多两行', '色卡只写颜色名', '艺术性大于完整小字'],
        defaultValues: ['只保留短标签', '标题必须可读'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'report-sections',
        variableName: 'reportSections',
        name: ['报告模块', 'Report sections'],
        description: ['定义信息图或设定板中应该出现的模块。', 'Defines sections that should appear in an infographic or production board.'],
        content: ['报告模块，如个人特征分析、色彩季型判断、上身颜色对比、角色设计区或镜头调度图。', 'Report sections such as personal feature analysis, seasonal color type, outfit color comparison, character design, or shot blocking map.'],
        candidates: ['个人特征分析', '色彩季型判断', '上身颜色对比', '专属色盘', '最显白Top5', '最提气色Top5', '妆容色彩建议', '发色方向建议', '饰品材质建议', '项目标题', '角色设计区', '场景设计区', '俯视镜头调度图', '分镜故事区', '灯光与风格', '情绪关键词', '声音设计', '摄影说明', '色彩方案'],
        defaultValues: ['个人特征分析', '色彩季型判断', '上身颜色对比', '专属色盘'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'storyboard-workflow',
        variableName: 'storyboardWorkflow',
        name: ['分镜生产流程', 'Storyboard workflow'],
        description: ['约束图片或视频分镜设计板需要体现的生产步骤。', 'Constrains production steps represented in storyboard or video planning boards.'],
        content: ['分镜生产流程，如场景拆解、主题故事、电影感手法、关键帧列表和联络单输出。', 'Storyboard workflow such as scene breakdown, theme/story, cinematic approach, keyframe list, and contact sheet output.'],
        candidates: ['场景拆解', '主题与故事', '电影感手法', '关键帧列表', '联络单输出', '角色设定板', '场景概念图', '俯视调度图', '镜头编号', '镜头类型', '焦段标注', '运动方式', '画面调度', '音效/音乐', '备注区', '一致性锁定', '轴线原则', '视线匹配'],
        defaultValues: ['场景拆解', '关键帧列表', '联络单输出'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'storyboard-shot-fields',
        variableName: 'storyboardShotFields',
        name: ['分镜镜头字段', 'Storyboard shot fields'],
        description: ['定义每个镜头或关键帧格子需要包含的可执行字段。', 'Defines executable fields for each shot or keyframe cell.'],
        content: ['分镜镜头字段，如镜头号、时长、景别、焦段、运镜、画面调度、音效和备注。', 'Storyboard shot fields such as shot number, duration, shot size, focal length, movement, blocking, sound, and notes.'],
        candidates: ['镜头号', '建议时长', '镜头类型', '景别', '焦段', '景深', '相机高度', '拍摄角度', '运动方式', '运镜示意图', '主体位置', '前中背景', '视线方向', '画面调度/动作', '简短对白或字幕', '音效/音乐', '光影调色', '备注'],
        defaultValues: ['镜头号', '建议时长', '镜头类型', '画面调度/动作'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'storyboard-continuity',
        variableName: 'storyboardContinuity',
        name: ['分镜连续性约束', 'Storyboard continuity'],
        description: ['约束故事板和关键帧之间的角色、空间、光影和剪辑逻辑连续。', 'Constrains continuity of characters, space, lighting, and editing logic across storyboard frames.'],
        content: ['分镜连续性约束，如同一环境延续、服装道具一致、轴线原则、视线匹配和镜头不要过于相似。', 'Storyboard continuity such as same environment, outfit and prop consistency, axis rule, eyeline match, and varied shots.'],
        candidates: ['同一环境逻辑延续', '角色身份一致', '服装道具一致', '光影调色一致', '视觉锚点固定', '轴线原则', '视线匹配', '景别真实变化', '镜头之间不要过于相似', '动作节拍连贯', '情绪弧线清楚', '信息不足时合理补全', '镜头中不出现摄像机设备', '不牺牲故事逻辑炫技', '关键帧可直接生成视频'],
        defaultValues: ['角色身份一致', '服装道具一致', '轴线原则', '视线匹配'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'production-board-density',
        variableName: 'productionBoardDensity',
        name: ['设定板信息密度', 'Production board density'],
        description: ['控制影视前期设定板、信息图海报和故事板的密度与可读性。', 'Controls density and readability for production boards, infographic posters, and storyboards.'],
        content: ['设定板信息密度，如信息密集但排版整洁、深色标题栏、模块边界清晰。', 'Production board density such as dense but tidy information, dark title bars, and clear module boundaries.'],
        candidates: ['信息密集但排版整洁', '结构清晰网格', '模块化排版', '深色标题栏', '分区边界明确', '现代UI设定板', '专业影视前期制作板', 'Behance风格', 'ArtStation风格', '商业级视觉设计', '顶部项目栏', '底部说明区', '图标辅助短标签', '高细节但不拥挤', '非漫画风', '非粗糙草图风'],
        defaultValues: ['信息密集但排版整洁', '结构清晰网格', '模块化排版'],
        multiple: true,
      }),
    ],
  }),
  createSystemCategory({
    id: 'typography-concept',
    icon: 'palette',
    name: ['字体与隐喻', 'Typography and Metaphor'],
    description: ['从字体美学样本人工提炼的文字主视觉、词义隐喻和字形互动变量。', 'Manually distilled controls for text-led visuals, semantic metaphors, and type interaction.'],
    tip: ['适合 Logo、字标、字体美学概念海报和文字主导型品牌视觉。', 'Useful for logos, wordmarks, typography concept posters, and text-led brand visuals.'],
    variables: [
      createSystemVariable({
        id: 'typography-role',
        variableName: 'typographyRole',
        name: ['文字主视觉角色', 'Typography role'],
        description: ['约束文字在画面中是否是绝对主体及其视觉权重。', 'Constrains whether text is the absolute subject and how much visual weight it has.'],
        content: ['文字主视觉角色，如文字绝对主角、占画面 50% 以上、第一眼可读或不是普通标题。', 'Typography role such as absolute text hero, occupying over 50%, instantly readable, or not a normal title.'],
        candidates: ['文字绝对主角', '文字占画面50%以上', '第一眼必须读懂', '不是普通标题', '字体本身体现词义', '背景服务文字', '辅助元素不能抢文字', '字形清晰可读', '文字像核心图腾', '文字与隐喻互动', '中文结构准确', '英文拼写准确', '字距字重高级', '定制标题字感'],
        defaultValues: ['文字绝对主角', '第一眼必须读懂'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'semantic-metaphor',
        variableName: 'semanticMetaphor',
        name: ['词义隐喻方向', 'Semantic metaphor direction'],
        description: ['把抽象字词转为更深层视觉隐喻，而不是表层配图。', 'Turns abstract words into deeper visual metaphors instead of literal illustration.'],
        content: ['词义隐喻方向，如边界消失、引力拉扯、测量规训、回应缺席或残影风化。', 'Semantic metaphor such as disappearing boundaries, gravitational pull, measurement discipline, absent response, or weathered afterimage.'],
        candidates: ['边界消失', '结构松动', '空间扩张', '引力拉扯', '占有与空洞', '测量规训', '坐标权限', '回应缺席', '尺度失衡', '信息过密', '呼吸空间被压缩', '秩序档案', '神话与废墟', '残影风化', '叠印回声', '层层递进', '内部空间', '不可逆时间线'],
        defaultValues: ['词义深层转译'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'font-interaction',
        variableName: 'fontInteraction',
        name: ['字形互动方式', 'Type interaction'],
        description: ['控制字形与图形、空间、材质或隐喻元素的互动方式。', 'Controls how letterforms interact with graphics, space, material, or metaphoric elements.'],
        content: ['字形互动方式，如笔画生长、局部断裂、负形图像、框架限制或从限制中突破。', 'Type interaction such as stroke growth, partial fracture, negative-space image, frame constraint, or breaking out.'],
        candidates: ['笔画生长', '局部断裂', '负形图像', '框架限制', '从限制中突破', '投下象征性阴影', '被拉扯压缩扩张', '与图形互相嵌套', '成为入口/容器', '像建筑结构', '像机器系统', '像生物形态', '线条连接笔画', '图形穿过文字但不破坏可读性', '文字内部隐藏第二层含义'],
        defaultValues: ['字形清晰可读', '与图形互相嵌套'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'adaptive-aspect',
        variableName: 'adaptiveAspect',
        name: ['自适应画幅逻辑', 'Adaptive aspect logic'],
        description: ['根据词义、叙事方向和空间隐喻选择画幅。', 'Chooses aspect ratio based on meaning, narrative direction, and spatial metaphor.'],
        content: ['自适应画幅逻辑，如方形图腾、竖版纪念碑、横版流动扩张、超宽史诗世界或超竖深渊。', 'Adaptive aspect logic such as square totem, vertical monument, horizontal expansion, ultrawide epic world, or tall abyss.'],
        candidates: ['方形图腾', '竖版纪念碑', '横版流动扩张', '21:9史诗世界', '9:16垂直压迫', '3:1信息流横幅', '凝聚核心用方形', '上升坠落用竖版', '旅程传播用横版', '文明宇宙用超宽', '深井高塔用超竖', '道路河流用横幅'],
        defaultValues: ['根据词义自动选择'],
        multiple: false,
      }),
      createSystemVariable({
        id: 'word-meaning-analysis',
        variableName: 'wordMeaningAnalysis',
        name: ['词义分析维度', 'Word meaning analysis'],
        description: ['定义字体概念海报在生成前需要分析的语义、情绪和空间维度。', 'Defines semantic, emotional, and spatial dimensions to analyze before typography poster generation.'],
        content: ['词义分析维度，如字面含义、情绪气质、心理张力、哲学联想和空间力量感。', 'Word meaning analysis such as literal meaning, emotion, psychological tension, philosophical associations, and spatial force.'],
        candidates: ['字面含义', '情绪气质', '隐喻与象征', '心理张力', '哲学/文化联想', '空间感与力量感', '双关与反差', '社会性含义', '悖论关系', '第一感受', '词语精神状态', '表层含义之外', '主题视觉人格', '核心视觉载体', '传播记忆点'],
        defaultValues: ['字面含义', '情绪气质', '隐喻与象征', '空间感与力量感'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'visual-metaphor-logic',
        variableName: 'visualMetaphorLogic',
        name: ['视觉隐喻逻辑', 'Visual metaphor logic'],
        description: ['控制文字主题如何转成关系、尺度、空间、符号或冲突画面。', 'Controls how text themes become relations, scale, space, symbols, or conflict scenes.'],
        content: ['视觉隐喻逻辑，如人物关系、物体关系、尺度反差、边界消解或秩序规训。', 'Visual metaphor logic such as character relations, object relations, scale contrast, boundary dissolution, or disciplined order.'],
        candidates: ['人物关系', '物体关系', '动作关系', '空间关系', '对比关系', '象征关系', '冲突关系', '秩序关系', '荒诞关系', '诗意关系', '尺度反差', '方向关系', '距离关系', '遮挡关系', '边界消解', '限制被打开', '引力靠近', '回应缺席', '未来逼近', '档案与废墟'],
        defaultValues: ['视觉隐喻系统', '尺度反差', '空间关系'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'type-legibility-guardrails',
        variableName: 'typeLegibilityGuardrails',
        name: ['字形可读性护栏', 'Type legibility guardrails'],
        description: ['约束中文、英文、字距、笔画和辅助文字在字体海报中的可读性。', 'Constrains readability for Chinese, English, spacing, strokes, and auxiliary text in typography posters.'],
        content: ['字形可读性护栏，如中文结构准确、英文拼写准确、不能错笔漏笔和小字克制。', 'Type legibility guardrails such as accurate Chinese structure, accurate English spelling, no missing strokes, and restrained small text.'],
        candidates: ['中文结构准确', '英文拼写准确', '不能多笔少笔', '不能错字漏字', '不能伪中文乱码', '尊重汉字间架结构', '字距字重高级', '基线节奏稳定', '负形空间清楚', '变形不破坏可读性', '辅助短句极简', '署名编号低调', '文字从画面中生长', '不要普通系统字体', '不要低级3D字效', '不要文字被遮挡'],
        defaultValues: ['中文结构准确', '英文拼写准确', '变形不破坏可读性'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'typography-style-system',
        variableName: 'typographyStyleSystem',
        name: ['字体风格系统', 'Typography style system'],
        description: ['根据词义选择字体海报的设计风格、印刷语言和审美系统。', 'Chooses typography poster design style, print language, and aesthetic system based on meaning.'],
        content: ['字体风格系统，如瑞士网格、东方书法、构成主义、实验字体或奢侈品牌视觉。', 'Typography style system such as Swiss grid, eastern calligraphy, constructivism, experimental type, or luxury brand visual.'],
        candidates: ['高级极简平面设计', '瑞士网格系统', '强构成主义海报', '日本当代平面设计', '东方书法与现代版式', '实验字体设计', '未来主义科技视觉', '古典碑铭与现代设计融合', '超现实主义概念海报', '先锋杂志封面', '高端文化展览海报', '奢侈品牌编辑视觉', '新包豪斯几何设计', '建筑化字体视觉', '视觉诗歌式字体海报', '丝网印刷质感', '石版印刷质感', '极简强概念图形海报'],
        defaultValues: ['实验字体设计', '高级极简平面设计'],
        multiple: true,
      }),
    ],
  }),
  createSystemCategory({
    id: 'text-generation',
    icon: 'boxes',
    name: ['文本生成', 'Text Generation'],
    description: ['文本类型、目标读者、语气、结构和输出格式。', 'Text type, target audience, tone, structure, and output format.'],
    tip: ['用于文本生成、改写、总结、营销文案和知识内容生产。', 'Useful for text generation, rewriting, summarization, marketing copy, and knowledge content.'],
    variables: [
      createSystemVariable({
        id: 'text-type',
        variableName: 'textType',
        name: ['文本类型', 'Text type'],
        description: ['指定要生成或改写的文本载体。', 'Specifies the text medium to generate or rewrite.'],
        content: ['文本类型，如文章、摘要、标题、广告文案、产品说明或邮件。', 'Text type, such as article, summary, headline, ad copy, product description, or email.'],
        candidates: ['长文文章', '短文摘要', '标题', '副标题', '广告文案', '产品说明', '邮件', '通知公告', '脚本对白', '短视频口播稿', '社交媒体帖文', '小红书笔记', '公众号文章', '知识卡片', 'FAQ', '教程步骤', '会议纪要', 'PRD段落', '周报', '新闻稿'],
        defaultValues: ['长文文章'],
        multiple: false,
      }),
      createSystemVariable({
        id: 'target-audience',
        variableName: 'targetAudience',
        name: ['目标读者', 'Target audience'],
        description: ['指定文本面向的人群、知识水平和阅读意图。', 'Specifies the audience, knowledge level, and reading intent.'],
        content: ['目标读者，如新手用户、专业人士、决策者、开发者或消费者。', 'Target audience, such as beginners, professionals, decision makers, developers, or consumers.'],
        candidates: ['新手用户', '普通消费者', '专业人士', '企业决策者', '开发者', '设计师', '运营人员', '销售团队', '客服团队', '学生', '老师', '投资人', '管理层', '社区用户', '内部团队', '潜在客户', '已有客户'],
        defaultValues: ['普通消费者'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'writing-tone',
        variableName: 'writingTone',
        name: ['写作语气', 'Writing tone'],
        description: ['控制文本的表达气质、情绪强度和可信度。', 'Controls expression style, emotional intensity, and credibility.'],
        content: ['写作语气，如专业、友好、克制、鼓舞、犀利、故事化或转化导向。', 'Writing tone, such as professional, friendly, restrained, inspiring, sharp, narrative, or conversion-oriented.'],
        candidates: ['专业严谨', '友好自然', '简洁直接', '克制客观', '鼓舞人心', '犀利观点', '故事化表达', '转化导向', '高端品牌感', '轻松幽默', '温和安抚', '权威可信', '年轻活泼', '学术风格', '新闻客观', '教程式耐心', '销售型紧迫感'],
        defaultValues: ['友好自然'],
        multiple: false,
      }),
      createSystemVariable({
        id: 'content-structure',
        variableName: 'contentStructure',
        name: ['内容结构', 'Content structure'],
        description: ['控制文本组织方式、段落顺序和信息层次。', 'Controls text organization, paragraph order, and information hierarchy.'],
        content: ['内容结构，如总分总、问题-方案、痛点-价值-行动、步骤列表或对比表。', 'Content structure, such as summary-detail-summary, problem-solution, pain-value-action, step list, or comparison table.'],
        candidates: ['总分总', '结论先行', '问题-方案', '痛点-价值-行动', '背景-分析-建议', '步骤列表', '表格对比', '要点清单', '故事开头', 'FAQ结构', '时间线结构', '金字塔结构', '案例-洞察-方法', '定义-例子-应用', '风险-对策', '摘要-详情-下一步'],
        defaultValues: ['结论先行'],
        multiple: false,
      }),
      createSystemVariable({
        id: 'length-density',
        variableName: 'lengthDensity',
        name: ['长度密度', 'Length and density'],
        description: ['控制文本长短、信息密度和展开程度。', 'Controls text length, information density, and expansion level.'],
        content: ['长度密度，如一句话、短段落、详细展开、信息高密度或适合移动端阅读。', 'Length and density, such as one sentence, short paragraph, detailed expansion, high information density, or mobile-friendly reading.'],
        candidates: ['一句话', '三句话以内', '短段落', '中等篇幅', '详细展开', '信息高密度', '低门槛解释', '适合移动端阅读', '适合演示稿', '适合落地页', '适合报告正文', '保留关键细节', '压缩到一半', '扩写到两倍'],
        defaultValues: ['中等篇幅'],
        multiple: false,
      }),
      createSystemVariable({
        id: 'text-output-format',
        variableName: 'textOutputFormat',
        name: ['输出格式', 'Output format'],
        description: ['指定文本结果的交付格式和排版方式。', 'Specifies the delivery format and layout of the text output.'],
        content: ['输出格式，如 Markdown、JSON、表格、清单、YAML、HTML片段或纯文本。', 'Output format, such as Markdown, JSON, table, checklist, YAML, HTML snippet, or plain text.'],
        candidates: ['Markdown', '纯文本', 'JSON', 'YAML', '表格', '编号列表', '项目符号列表', '检查清单', 'HTML片段', 'CSV', '键值对', '标题+正文', '摘要+正文', '可复制模板', '双语对照'],
        defaultValues: ['Markdown'],
        multiple: false,
      }),
    ],
  }),
  createSystemCategory({
    id: 'text-refinement',
    icon: 'boxes',
    name: ['文本控制', 'Text Control'],
    description: ['论证、信息来源、改写策略和文本禁用项。', 'Argumentation, source handling, rewrite strategy, and text constraints.'],
    tip: ['用于把文本生成从“写出来”提升到“可控、可审、可复用”。', 'Makes text generation controllable, reviewable, and reusable.'],
    variables: [
      createSystemVariable({
        id: 'argument-method',
        variableName: 'argumentMethod',
        name: ['论证方式', 'Argument method'],
        description: ['控制观点、证据和结论之间的组织方式。', 'Controls how claims, evidence, and conclusions are organized.'],
        content: ['论证方式，如数据支撑、案例支撑、反例比较、因果分析或优缺点权衡。', 'Argument method, such as data support, case support, counterexample comparison, causal analysis, or tradeoff analysis.'],
        candidates: ['数据支撑', '案例支撑', '反例比较', '因果分析', '优缺点权衡', '场景推演', '专家观点', '用户证言', '类比说明', '逻辑演绎', '归纳总结', '风险拆解', '成本收益分析', '竞品对比'],
        defaultValues: ['案例支撑'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'source-handling',
        variableName: 'sourceHandling',
        name: ['信息来源', 'Source handling'],
        description: ['约束模型如何使用、标注或处理资料来源。', 'Constrains how the model uses, labels, or handles sources.'],
        content: ['信息来源策略，如仅基于提供材料、标注不确定性、区分事实与推断或列出引用。', 'Source handling strategy, such as use only provided materials, mark uncertainty, separate facts from inference, or list citations.'],
        candidates: ['仅基于提供材料', '允许常识补充', '标注不确定性', '区分事实与推断', '列出引用', '不要编造来源', '缺资料时说明缺口', '保留原文关键措辞', '先提炼再改写', '忽略无关材料', '合并重复信息', '保留数字单位'],
        defaultValues: ['仅基于提供材料'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'rewrite-strategy',
        variableName: 'rewriteStrategy',
        name: ['改写策略', 'Rewrite strategy'],
        description: ['控制对原文的保留、压缩、扩写和风格转换。', 'Controls preserving, compressing, expanding, and changing style from the source text.'],
        content: ['改写策略，如保留核心含义、压缩冗余、增强说服力、口语化或专业化。', 'Rewrite strategy, such as preserve meaning, compress redundancy, improve persuasion, make conversational, or make professional.'],
        candidates: ['保留核心含义', '压缩冗余', '扩写细节', '增强说服力', '降低理解门槛', '提升专业度', '口语化', '书面化', '品牌化表达', '更强行动号召', '去除夸张', '提升可读性', '更适合短视频', '更适合销售页', '保留原文结构', '重组信息层次'],
        defaultValues: ['提升可读性'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'text-avoidance',
        variableName: 'textAvoidance',
        name: ['文本禁用项', 'Text avoidance'],
        description: ['限制文本中不应出现的表达、结构或风险。', 'Limits expressions, structures, or risks that should not appear.'],
        content: ['文本禁用项，如不要空话套话、不要虚构数据、不要过度营销或不要泄露隐私。', 'Text avoidance, such as no empty slogans, no fabricated data, no over-marketing, or no privacy leakage.'],
        candidates: ['不要空话套话', '不要虚构数据', '不要过度营销', '不要绝对化承诺', '不要泄露隐私', '不要使用敏感词', '不要长句堆叠', '不要重复观点', '不要未经解释的术语', '不要攻击性表达', '不要引用未知来源', '不要输出无关建议', '不要使用表情符号', '不要标题党'],
        defaultValues: ['不要虚构数据', '不要空话套话'],
        multiple: true,
      }),
    ],
  }),
  createSystemCategory({
    id: 'commerce',
    icon: 'store',
    name: ['电商转化', 'Commerce Conversion'],
    description: ['商品卖点、促销语气、购买动机和渠道表达。', 'Product selling points, campaign tone, buying motives, and channel wording.'],
    tip: ['适合商品详情页、广告图、短视频口播和活动文案。', 'Useful for product pages, ad images, short-video scripts, and campaign copy.'],
    variables: [
      createSystemVariable({
        id: 'selling-point',
        variableName: 'sellingPoint',
        name: ['核心卖点', 'Selling point'],
        description: ['指定最优先强调的商品价值。', 'Specifies the product value to emphasize first.'],
        content: ['商品核心卖点，如耐用、轻量、环保、高端质感、性价比或快速见效。', 'Core selling point, such as durable, lightweight, eco-friendly, premium texture, cost-effective, or fast results.'],
        candidates: ['耐用', '轻量', '环保', '高端质感', '性价比', '快速见效', '易上手', '省时间', '省空间', '安全可靠', '专业级', '便携', '静音', '低维护', '颜值高', '礼品属性', '限量稀缺', '可定制'],
        defaultValues: ['高端质感'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'campaign-tone',
        variableName: 'campaignTone',
        name: ['促销语气', 'Campaign tone'],
        description: ['控制转化文案的促销强度。', 'Controls promotion intensity for conversion copy.'],
        content: ['促销表达语气，如限时、会员专属、新品首发、礼赠或清仓。', 'Campaign tone, such as limited-time, members-only, new launch, gift-with-purchase, or clearance.'],
        candidates: ['限时', '会员专属', '新品首发', '礼赠', '满减', '买赠', '清仓', '预售', '节日大促', '组合套装', '老客回馈', '试用装', '官方补贴', '爆款返场', '早鸟优惠'],
        defaultValues: ['新品首发'],
        multiple: false,
      }),
      createSystemVariable({
        id: 'purchase-motivation',
        variableName: 'purchaseMotivation',
        name: ['购买动机', 'Purchase motivation'],
        description: ['触发用户购买、收藏、咨询或分享的主要心理动因。', 'Main motivation for purchase, save, inquiry, or sharing.'],
        content: ['购买动机，如解决痛点、身份表达、节省成本、提升效率或送礼。', 'Purchase motivation, such as solving pain points, identity expression, saving cost, improving efficiency, or gifting.'],
        candidates: ['解决痛点', '提升效率', '节省成本', '身份表达', '送礼体面', '降低风险', '即时满足', '长期收益', '社交分享', '专业升级', '生活品质', '健康安全', '孩子成长', '办公效率', '旅行便利'],
        defaultValues: ['解决痛点'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'commerce-channel',
        variableName: 'commerceChannel',
        name: ['转化渠道', 'Commerce channel'],
        description: ['指定文案或图片最终发布的渠道和表达约束。', 'Specifies the final publishing channel and expression constraints.'],
        content: ['转化渠道，如电商详情页、直播间话术、小红书笔记、短视频口播或信息流广告。', 'Commerce channel, such as ecommerce detail page, livestream script, Xiaohongshu note, short-video voiceover, or feed ad.'],
        candidates: ['电商详情页', '电商主图', '直播间话术', '小红书笔记', '短视频口播', '信息流广告', '朋友圈文案', '社群转化', '短信促销', '邮件营销', '落地页首屏', '橱窗标题', '客服推荐话术'],
        defaultValues: ['电商详情页'],
        multiple: false,
      }),
    ],
  }),
  createSystemCategory({
    id: 'agent-output',
    icon: 'bot',
    name: ['Agent 输出', 'Agent Output'],
    description: ['Agent 角色边界、执行流程、工具策略和结构化响应。', 'Agent role boundaries, execution flow, tool policy, and structured responses.'],
    tip: ['适合在 Agent 提示词中统一工作方式、输出规范和验收标准。', 'Useful for standardizing agent workflow, output format, and acceptance criteria.'],
    variables: [
      createSystemVariable({
        id: 'agent-role',
        variableName: 'agentRole',
        name: ['Agent 角色', 'Agent role'],
        description: ['定义 Agent 的专业身份、职责边界和默认立场。', 'Defines the agents professional identity, responsibility boundary, and default stance.'],
        content: ['Agent 角色，如研究员、代码审阅者、产品经理、数据分析师或客服专家。', 'Agent role, such as researcher, code reviewer, product manager, data analyst, or support specialist.'],
        candidates: ['研究员', '代码审阅者', '软件工程师', '产品经理', '数据分析师', '运营顾问', '客服专家', '销售顾问', '法务助理', '财务分析师', '教学助教', '需求分析师', '测试工程师', '安全审计员', '写作编辑', '项目经理'],
        defaultValues: ['研究员'],
        multiple: false,
      }),
      createSystemVariable({
        id: 'answer-shape',
        variableName: 'answerShape',
        name: ['回答结构', 'Answer shape'],
        description: ['约束 Agent 输出结构。', 'Constrains the structure of agent output.'],
        content: ['回答结构，如摘要优先、步骤列表、表格对比、结论后置或风险优先。', 'Answer shape, such as summary first, steps, comparison table, conclusion last, or risk first.'],
        candidates: ['摘要优先', '步骤列表', '表格对比', '结论后置', '风险优先', '先问后答', '先给方案再解释', '发现-影响-建议', '问题-原因-修复', '清单式验收', '分阶段计划', '只输出结果', '附开放问题', '附下一步行动'],
        defaultValues: ['摘要优先'],
        multiple: false,
      }),
      createSystemVariable({
        id: 'review-depth',
        variableName: 'reviewDepth',
        name: ['审阅深度', 'Review depth'],
        description: ['设置检查、评审或分析的严格程度。', 'Sets the strictness of review, inspection, or analysis.'],
        content: ['审阅深度，如快速检查、逐段审阅、风险优先、验收清单或高风险深挖。', 'Review depth, such as quick check, paragraph review, risk first, acceptance checklist, or high-risk deep dive.'],
        candidates: ['快速检查', '逐段审阅', '风险优先', '验收清单', '高风险深挖', '边界条件检查', '数据一致性检查', '安全隐患检查', '用户体验检查', '性能影响检查', '可维护性检查', '回归风险检查'],
        defaultValues: ['风险优先'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'execution-flow',
        variableName: 'executionFlow',
        name: ['执行流程', 'Execution flow'],
        description: ['约束 Agent 完成任务时的步骤顺序和推进方式。', 'Constrains the step order and execution style for completing tasks.'],
        content: ['执行流程，如先理解目标、收集上下文、提出计划、执行、验证和总结。', 'Execution flow, such as understand goal, gather context, plan, execute, verify, and summarize.'],
        candidates: ['先理解目标', '先收集上下文', '先列计划', '边做边验证', '先给最小可行方案', '分阶段交付', '先处理阻塞点', '先复现问题', '先查证事实', '先评估风险', '完成后总结', '失败时说明原因', '保留决策记录'],
        defaultValues: ['先理解目标', '边做边验证'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'tool-use-policy',
        variableName: 'toolUsePolicy',
        name: ['工具策略', 'Tool policy'],
        description: ['定义 Agent 何时使用工具、如何处理工具结果和失败。', 'Defines when the agent uses tools and how it handles tool results and failures.'],
        content: ['工具策略，如先查本地、必要时联网、引用工具结果、工具失败则说明限制。', 'Tool policy, such as check local context first, browse when needed, cite tool results, and explain tool failures.'],
        candidates: ['先查本地上下文', '必要时联网查证', '优先使用官方来源', '引用工具结果', '工具失败说明限制', '不要伪造工具结果', '高风险信息必须查证', '代码修改后运行验证', '避免无关工具调用', '保留关键命令输出', '敏感操作先确认', '并行查询独立问题'],
        defaultValues: ['先查本地上下文'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'clarification-policy',
        variableName: 'clarificationPolicy',
        name: ['澄清策略', 'Clarification policy'],
        description: ['定义 Agent 在信息不足、需求冲突或高风险时如何提问。', 'Defines how the agent asks questions when information is missing, conflicting, or high risk.'],
        content: ['澄清策略，如能自行查证则不问、关键歧义必须确认、默认选择保守方案。', 'Clarification policy, such as do not ask if discoverable, confirm key ambiguity, or choose conservative defaults.'],
        candidates: ['能自行查证则不问', '关键歧义必须确认', '高风险操作先确认', '给出推荐默认项', '一次最多问三个问题', '先说明影响再提问', '低风险按默认假设推进', '需求冲突时以后者为准', '无法判断时暂停', '记录未确认假设'],
        defaultValues: ['能自行查证则不问', '关键歧义必须确认'],
        multiple: true,
      }),
      createSystemVariable({
        id: 'acceptance-criteria',
        variableName: 'acceptanceCriteria',
        name: ['验收标准', 'Acceptance criteria'],
        description: ['定义 Agent 完成任务时必须满足的检查项。', 'Defines checks that must pass before the agent considers the task complete.'],
        content: ['验收标准，如可运行、类型检查通过、覆盖边界情况、输出可复制或说明残余风险。', 'Acceptance criteria, such as runnable, type-check passing, edge cases covered, copyable output, or residual risks explained.'],
        candidates: ['结果可运行', '类型检查通过', '构建通过', '覆盖边界情况', '关键路径验证', '输出可复制', '无敏感信息泄露', '错误路径有说明', '残余风险已列出', '用户能直接使用', '变更范围可解释', '不破坏旧数据', '性能无明显退化'],
        defaultValues: ['关键路径验证'],
        multiple: true,
      }),
    ],
  }),
]

export const COMMUNITY_RECIPE_VARIABLE_CATEGORIES: RecipeVariableCategory[] = []

export function cloneRecipeVariableCategories(categories: RecipeVariableCategory[]) {
  return categories.map((category) => ({
    ...category,
    name: { ...category.name },
    description: { ...category.description },
    tip: { ...category.tip },
    changeLog: category.changeLog.map(cloneRecipeVariableChangeLog),
    variables: category.variables.map(cloneRecipeVariableItem),
  }))
}

export function getDefaultRecipeVariableCategories() {
  return cloneRecipeVariableCategories([...SYSTEM_RECIPE_VARIABLE_CATEGORIES, ...COMMUNITY_RECIPE_VARIABLE_CATEGORIES])
}

export function flattenRecipeVariables(categories: RecipeVariableCategory[]) {
  return categories.flatMap((category) => category.variables.map((variable) => ({ category, variable })))
}

export function getRecipeVariableStats(categories: RecipeVariableCategory[]): RecipeVariableStats {
  return categories.reduce<RecipeVariableStats>(
    (stats, category) => {
      stats[category.scope] += category.variables.length
      return stats
    },
    { system: 0, personal: 0, community: 0 },
  )
}

export function formatRecipeVariableSourceId(variable: Pick<RecipeVariableItem, 'id' | 'scope' | 'sourceId'>) {
  if ('sourceId' in variable && typeof variable.sourceId === 'string' && variable.sourceId) return variable.sourceId
  return `${variable.scope}:${variable.id}`
}

export function parseRecipeVariableSourceId(value: string): { scope: RecipeVariableScope; id: string } {
  const [rawScope, ...rest] = value.split(':')
  const id = rest.join(':').trim()
  if ((rawScope === 'system' || rawScope === 'personal' || rawScope === 'community') && id) {
    return { scope: rawScope, id }
  }
  return { scope: 'system', id: value.trim() }
}

export function findRecipeVariableBySourceId(categories: RecipeVariableCategory[], sourceId: string) {
  const parsed = parseRecipeVariableSourceId(sourceId)
  const flattened = flattenRecipeVariables(categories)
  return flattened.find(({ variable }) => {
    if (variable.sourceId && sourceIdsEqual(variable.sourceId, sourceId)) return true
    if (variable.scope === parsed.scope && variable.id === parsed.id) return true
    return !sourceId.includes(':') && variable.scope === 'system' && variable.id === sourceId
  }) || flattened.find(({ variable }) => variable.id === parsed.id) || null
}

export function createRecipeVariableSnapshot(input: {
  tokenName: string
  sourceId: string
  category: RecipeVariableCategory
  variable: RecipeVariableItem
}): RecipeVariableSnapshot {
  const { tokenName, sourceId, category, variable } = input
  return {
    tokenName,
    sourceId,
    sourceFilePath: variable.sourceFilePath,
    scope: variable.scope,
    id: variable.id,
    categoryId: category.id,
    categoryName: { ...category.name },
    variableName: variable.variableName,
    name: { ...variable.name },
    description: { ...variable.description },
    content: { ...variable.content },
    candidates: cloneCandidates(variable.candidates),
    defaultValues: [...variable.defaultValues],
    multiple: variable.multiple,
    updatedAt: variable.updatedAt,
    changeLog: variable.changeLog.map(cloneRecipeVariableChangeLog),
  }
}

export function normalizeRecipeVariableMetadata(value: unknown): ZpmtRecipeVariableMetadata {
  if (!isRecord(value)) return { schemaVersion: 2, recipeVariables: [] }
  const snapshots = Array.isArray(value.recipeVariables) ? value.recipeVariables : []
  return {
    schemaVersion: 2,
    recipeVariables: snapshots.map(normalizeRecipeVariableSnapshot).filter((item): item is RecipeVariableSnapshot => Boolean(item)),
  }
}

export function findRecipeVariableSnapshot(
  metadata: ZpmtRecipeVariableMetadata | undefined,
  tokenName: string,
  sourceId: string,
) {
  if (!metadata) return null
  return metadata.recipeVariables.find((snapshot) => snapshot.tokenName === tokenName && sourceIdsEqual(snapshot.sourceId, sourceId)) || null
}

export function sourceIdsEqual(left: string, right: string) {
  if (left === right) return true
  if (left.includes('#') || right.includes('#')) return false
  const parsedLeft = parseRecipeVariableSourceId(left)
  const parsedRight = parseRecipeVariableSourceId(right)
  return parsedLeft.scope === parsedRight.scope && parsedLeft.id === parsedRight.id
}

function createSystemCategory(input: {
  id: string
  icon: string
  name: [string, string]
  description: [string, string]
  tip: [string, string]
  variables: RecipeVariableItem[]
}): RecipeVariableCategory {
  return {
    id: input.id,
    scope: 'system',
    icon: input.icon,
    name: toLocalizedText(input.name),
    description: toLocalizedText(input.description),
    tip: toLocalizedText(input.tip),
    createdAt: SYSTEM_UPDATED_AT,
    updatedAt: SYSTEM_UPDATED_AT,
    changeLog: [
      {
        version: '1.0.0',
        date: '2026-05-11',
        note: { zh: `初始化「${input.name[0]}」系统配方分类。`, en: `Initialized "${input.name[1]}" system recipe category.` },
      },
    ],
    variables: input.variables,
  }
}

function createSystemVariable(input: {
  id: string
  variableName: string
  name: [string, string]
  description: [string, string]
  content: [string, string]
  candidates: string[]
  candidatesEn?: string[]
  defaultValues: string[]
  multiple: boolean
}): RecipeVariableItem {
  return createSeedVariable({
    id: input.id,
    scope: 'system',
    variableName: input.variableName,
    name: toLocalizedText(input.name),
    description: toLocalizedText(input.description),
    content: toLocalizedText(input.content),
    candidates: localizedCandidates(input.candidates, input.candidatesEn),
    defaultValues: input.defaultValues,
    multiple: input.multiple,
  })
}

function toLocalizedText(value: [string, string]): LocalizedText {
  return { zh: value[0], en: value[1] || value[0] }
}

function localizedCandidates(zh: string[], en = zh): Record<Locale, string[]> {
  return { zh, en }
}

function createSeedVariable(input: Omit<RecipeVariableItem, 'createdAt' | 'updatedAt' | 'changeLog'>): RecipeVariableItem {
  return {
    ...input,
    createdAt: input.scope === 'community' ? COMMUNITY_UPDATED_AT : SYSTEM_UPDATED_AT,
    updatedAt: input.scope === 'community' ? COMMUNITY_UPDATED_AT : SYSTEM_UPDATED_AT,
    changeLog: [
      {
        version: '1.0.0',
        date: input.scope === 'community' ? '2026-05-09' : '2026-05-11',
        note: { zh: `初始化「${input.name.zh}」变量。`, en: `Initialized "${input.name.en}" variable.` },
      },
    ],
  }
}

function cloneRecipeVariableItem(variable: RecipeVariableItem): RecipeVariableItem {
  return {
    ...variable,
    name: { ...variable.name },
    description: { ...variable.description },
    content: { ...variable.content },
    candidates: cloneCandidates(variable.candidates),
    defaultValues: [...variable.defaultValues],
    changeLog: variable.changeLog.map(cloneRecipeVariableChangeLog),
  }
}

function cloneRecipeVariableChangeLog(item: RecipeVariableChangeLog): RecipeVariableChangeLog {
  return {
    version: item.version,
    date: item.date,
    note: { ...item.note },
  }
}

function cloneCandidates(value: Record<Locale, string[]>) {
  return {
    zh: [...value.zh],
    en: [...value.en],
  }
}

function normalizeRecipeVariableSnapshot(value: unknown): RecipeVariableSnapshot | null {
  if (!isRecord(value)) return null
  const id = readString(value.id)
  const tokenName = readString(value.tokenName)
  const sourceId = readString(value.sourceId)
  const scope = normalizeScope(value.scope)
  if (!id || !tokenName || !sourceId) return null

  return {
    tokenName,
    sourceId,
    sourceFilePath: readString(value.sourceFilePath) || undefined,
    scope,
    id,
    categoryId: readString(value.categoryId),
    categoryName: readLocalizedText(value.categoryName, ''),
    variableName: readString(value.variableName) || tokenName,
    name: readLocalizedText(value.name, tokenName),
    description: readLocalizedText(value.description, ''),
    content: readLocalizedText(value.content, ''),
    candidates: readLocalizedCandidates(value.candidates),
    defaultValues: readStringArray(value.defaultValues),
    multiple: value.multiple === true,
    updatedAt: readString(value.updatedAt) || undefined,
    changeLog: normalizeChangeLog(value.changeLog),
  }
}

function normalizeScope(value: unknown): RecipeVariableScope {
  return value === 'personal' || value === 'community' ? value : 'system'
}

function normalizeChangeLog(value: unknown): RecipeVariableChangeLog[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!isRecord(item)) return []
    const version = readString(item.version)
    const date = readString(item.date)
    const note = readLocalizedText(item.note, '')
    if (!version && !date && !note.zh && !note.en) return []
    return [{ version, date, note }]
  })
}

function readLocalizedText(value: unknown, fallback: string): LocalizedText {
  if (typeof value === 'string') return { zh: value, en: value }
  if (!isRecord(value)) return { zh: fallback, en: fallback }
  const zh = readString(value.zh)
  const en = readString(value.en)
  return {
    zh: zh || en || fallback,
    en: en || zh || fallback,
  }
}

function readLocalizedCandidates(value: unknown): Record<Locale, string[]> {
  if (!isRecord(value)) return { zh: [], en: [] }
  return {
    zh: readStringArray(value.zh),
    en: readStringArray(value.en),
  }
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map(readString).filter(Boolean)
}

function readString(value: unknown) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
