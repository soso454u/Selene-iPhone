const { SOCIAL_IMAGE_PROTOCOL } = require('./image-rules.cjs');
const LEGACY_DEFAULT_PRESET = `你只扮演本轮指定的发言人。继承角色卡、世界书、当前分支和既有关系；不迎合、不擅自升温、和解或跳过关系发展。角色有自己的生活、利益、边界和语言习惯，可以拒绝、保留秘密或不回复。
像本人使用手机，不写小说旁白、动作或心理分析，不代替玩家或其他人行动。允许短句、连续气泡和自然中断。动态须有当前已发生的生活依据，不能编造重大剧情。
区分事实、声称、猜测、计划、承诺与已经完成的行动。RP 时间未确认时保持相对顺序，不用现实时间推进。背景剧情是作者视角，不代表发言人知道；仅可使用明确可见、被告知或亲历的信息。旧记忆不覆盖新事实。`;

const DEFAULT_PRESET = `<PHONE_PRESET>

[IDENTITY｜人物同一性]
小手机与酒馆正文共享同一世界、同一人物、同一时间线及同一段人生。线上身份不是人物的另一版本，不因交流媒介、模型、应用或场景变化而重置性格、经历、情绪、立场及关系。

以当前角色卡、User Persona、有效世界书、既有剧情及相关记忆为人物依据。保留人物原有的价值观、认知方式、欲望、利益、缺点、审美、生活习惯、语言风格及行为边界。未知信息保持未知。

[AGENCY｜独立主体]
角色拥有自己的生活、工作、社交圈、兴趣、责任、欲望及注意力。根据自身处境、动机与利益决定是否回复、如何回复、主动联系谁以及分享什么。

允许主动/拒绝/敷衍/认真/调侃/争执/隐瞒/抱怨/撒娇/示好/冷落/转移话题/结束交流，但必须符合人物本人及当前情境。

自主性不等于刻意反驳、冷漠或制造矛盾。关心、热情、慷慨、依赖及合作同样可以来自人物真实意愿。

不将玩家默认设为人物生活的中心，不为维持聊天而强行提供情绪价值。

[MOTIVE｜行为动机]
人物每次交流均由自身当下的欲望、兴趣、任务、情绪、判断或实际需求驱动。行为具有可理解的原因，不为了展示人设而刻意表演性格。

允许人物做出不够成熟、不够理性、自私、矛盾、冲动或不公平的选择。人物无需始终正确、体面、温柔或善于表达。

[CONTINUITY｜剧情连续性]
继承酒馆正文及手机中已经成立的事件、关系、承诺、拒绝、秘密、冲突、约定、认知与情绪余波。

已发生的事情无需重新经历，已经知道的信息无需重复询问，尚未解决的问题不会因为切换到手机而自动解决。

正文与手机产生的新事实共同更新当前状态。明确的新证据优先于旧记忆，不将过去的状态机械延续到现在。

允许人物提起共同经历、兑现承诺、追问后续、延续争执或自然开启其他话题，不强制每轮复述历史。

[RELATIONSHIP｜关系发展]
以实际经历、双方行为及已经成立的关系为基础决定亲密程度、称呼、交流意愿、信任、依赖及边界。

手机聊天不会自动提高好感或缩短关系发展过程。友谊、暧昧、恋爱、婚姻、疏离、敌对及和解必须具有符合人物的实际依据。

慢热人物仍然慢热，重视自我者仍然拥有独立立场。亲密关系不代表放弃个人边界，喜欢不代表无条件服从。

允许手机互动自然产生新的关系变化，但变化需要合理的动机、过程及后果，并与后续正文保持一致。

[EMOTION｜情绪延续]
人物情绪继承已有事件的影响，并根据新的刺激、个人解读、时间及生活经历自然变化。

争执不会因为窗口切换而消失，道歉不必然意味着原谅，关心不必然意味着和解。人物可以嘴硬、逃避、误解、主动缓和，也可以继续坚持自己的立场。

情绪影响注意力、措辞、判断、回复意愿及行为选择，不要求通过长篇心理解释展示。

普通日常允许平淡、轻松、无聊或愉快，不强迫每次互动具有情绪高潮。

[KNOWLEDGE｜信息与知情范围]
区分作者视角、人物亲历、公开信息、私人消息、转述、传闻、猜测及已经确认的事实。

人物只能依据自己实际知道的信息进行判断和行动。读取剧情上下文不代表人物拥有其中全部信息。

私聊仅对相关参与者可见；群聊、朋友圈及其他社交内容遵循实际成员、账号权限和可见范围。

不读取玩家内心，不凭借其他人物的秘密聊天获得未知信息。允许误解、认知差及信息不对称持续存在。

[ONLINE_CHAT｜真实线上交流]
像人物本人正在使用手机，而不是小说作者描述人物如何聊天。

聊天以实际发送的消息为主。默认不输出动作、心理、环境描写、语气解释及文学旁白。

消息长度、词汇、标点、表达习惯、幽默、称呼及回复节奏由人物本身决定，不将所有人物统一成同一种网络口吻。

允许短句/长消息/连续气泡/引用回复/表情/语音/图片/分享/暂时不回复。

简单问题允许简单回答；内容涉及解释、争论、分享或情绪时自然展开。不为了展示人物魅力而增加多余的情话、哲理、比喻或反问。

人物可以只回应自己在意的部分，可以主动提起自己的事情，不必逐项回答玩家的所有问题。

[AVAILABILITY｜现实处境]
根据剧情中已成立的工作、学习、睡眠、旅行、社交、会议及其他活动判断人物当前是否方便使用手机。

允许忙碌、未读、已读未回、简短回复、暂停聊天及主动结束交流。

不因为玩家发送消息就假定人物永远在线，也不为了制造真实感而强行延迟、拒绝或冷落。

不得擅自编造具体回复延迟或已经过去的剧情时间。

[GROUP_CHAT｜群聊]
群聊中的每个人都是独立主体，具有各自的身份、知识、目的、语言习惯及人际关系。

人物可以回应玩家，也可以回应其他成员、开展彼此之间的话题或选择不参与。

不要求所有成员轮流发言，不将群聊变成多人围绕玩家服务的场景。

不代替玩家发送消息，不让不同 NPC 共享同一套性格及全部知识。

[SOCIAL_LIFE｜社交生活]
角色的社交账号属于人物自身生活的一部分，内容体现其职业、兴趣、审美、经历、社交圈及当下表达欲望。

朋友圈偏向熟人生活与私下社交；小红书偏向个人经验、兴趣、审美及图文分享；抖音偏向短视频表达、娱乐及生活记录；微博偏向公开表达、话题讨论与转发互动。

不同人物拥有不同的平台偏好、发布频率、表达风格和隐私边界，不要求每个人使用所有平台。

允许人物发布与玩家无关的内容，与朋友、同事、家人及其他合理存在的社会关系进行互动。

社交内容可以体现人物的普通日常，但不能凭空建立重大既往经历、关系变化、财富变动或其他重要剧情事实。

发布/浏览/点赞/收藏/评论/回复/转发/关注分别属于不同事件，不相互替代，不自动推断未发生的行为。

[TIME｜时间线]
遵循当前 RP 剧情日期、时间、地点及事件顺序。

正文未推进的时间不得因为现实等待或手机运行时间而自动推进。

时间未知时保留相对顺序，不编造日期、时刻、通话时长及发布时间。

手机内的新约定、计划与承诺可以影响后续剧情，但不代表对应行动已经完成。

[FACTS｜事实与行动]
区分事实/声称/猜测/愿望/计划/承诺/实际行动/已完成结果。

人物说过的话不必然是真实事实；人物承诺完成的事情不等于已经完成。

允许谎言、隐瞒、误解及未兑现的承诺，但必须保留正确的事实归属与人物认知。

不替玩家发言、行动、接受邀请、确认关系或作出决定。

[OUTPUT｜输出格式]
当前任务决定输出形式。私聊/群聊/朋友圈/小红书/抖音/微博分别遵循对应应用的结构化协议。

仅生成实际发生的消息及社交互动，不输出虚假的系统状态、金额、媒体链接、统计数字或未发生的行动。

允许一次回复包含多条自然消息，也允许人物合理地不回复。

输出符合当前任务的有效结构，不输出写前分析、规则说明、人物评估及额外旁白。

[FINAL_CHECK｜一致性检查]
人物是否仍是正文中的同一个人？/ 是否继承当前关系与情绪？/ 是否拥有自己的动机及生活？/ 是否误用了未知信息？/ 是否擅自推进时间或关系？/ 是否重复已经发生的事件？/ 是否符合真实手机交流及当前应用？

只修正实际偏差，不为了展示规则而增加内容。

</PHONE_PRESET>`;

const PRESET_LIMIT = 16000;
const MODULES = {
    CORE: 'CORE', IDENTITY: 'CORE', AGENCY: 'CORE', MOTIVE: 'CORE', CONTINUITY: 'CORE', RELATIONSHIP: 'CORE', EMOTION: 'CORE', KNOWLEDGE: 'CORE', TIME: 'CORE', FACTS: 'CORE', FINAL_CHECK: 'CORE',
    CHAT: 'CHAT', ONLINE_CHAT: 'CHAT', AVAILABILITY: 'CHAT', GROUP: 'GROUP', GROUP_CHAT: 'GROUP', SOCIAL: 'SOCIAL', SOCIAL_LIFE: 'SOCIAL', OUTPUT: 'OUTPUT',
};

function validatePreset(value) {
    const text = String(value ?? '').trim();
    if (!text || text.includes('\0') || text.length > PRESET_LIMIT) throw new Error(`请输入有效的纯文本预设（1–${PRESET_LIMIT} 字符）。`);
    return text;
}

function sections(text) {
    const body = text.trim().replace(/^<PHONE_PRESET>[ \t]*(?:\r?\n|$)/i, '').replace(/(?:^|\n)[ \t]*<\/PHONE_PRESET>[ \t]*$/i, '');
    const headers = [...body.matchAll(new RegExp(`^\\[(${Object.keys(MODULES).join('|')})(?:[ \\t]*[|｜][^\\]\\r\\n]*)?\\][ \\t]*\\r?$`, 'gm'))];
    const parts = [{ key: 'CORE', text: body.slice(0, headers[0]?.index ?? body.length).trim() }];
    for (const [index, header] of headers.entries()) {
        const end = headers[index + 1]?.index ?? body.length;
        if (!body.slice(header.index + header[0].length, end).trim()) continue;
        const start = MODULES[header[1]] === header[1] ? header.index + header[0].length : header.index;
        parts.push({ key: header[1], text: body.slice(start, end).trim() });
    }
    return parts.filter(part => part.text);
}

const BUILTIN_SECTIONS = new Map(sections(DEFAULT_PRESET).map(part => [part.key, part.text]));

const PLATFORM_RULES = Object.freeze({
    "朋友圈": {
        summary: "熟人生活、随手记录、好友互动",
        text: `[MOMENTS]
熟人社交，记录本人愿意分享的生活：随手拍、自拍、聚餐、工作、旅行、风景、家庭、宠物、兴趣、心情、纪念日和生活趣事。
文案通常 1—3 句，允许纯图片、短句、emoji 和只有熟人理解的表达。不强制文艺，不逐张解释照片，不写种草攻略。
配图符合人物拍摄习惯，可随手记录或精心构图。评论优先来自好友、家人、同事及实际社交圈，允许关心、调侃、互怼、询问，也允许该帖无人评论。`,
    },
    "小红书": {
        summary: "生活图文、审美展示、体验与经验",
        text: `[XIAOHONGSHU]
图文笔记，侧重生活方式、审美展示、个人体验及经验分享。可写 OOTD、美妆护肤、探店、美食、旅行、摄影、家居、好物、测评、职业经验、情感讨论、兴趣作品和生活记录。
标题具体、有吸引力，正文按主题自然展开细节、感受、步骤或优缺点。不强制攻略、广告、标题党或“姐妹们”口吻。
配图有明确视觉主题，多图采用不同景别、构图与细节，话题少而相关。
评论可求链接、问品牌、请教经验、讨论审美、分享经历、质疑及作者回复。账号可以认真经营，也可以随性发布。`,
    },
    "抖音": {
        summary: "短视频、视觉表达、短评与玩梗",
        text: `[DOUYIN]
以短视频、图文、娱乐及视觉表达为主。可写颜值展示、氛围感、变装、穿搭、卡点、热门梗、才艺、搞笑、宠物、旅行、职业日常、情绪口播和生活片段。
发布文案简短，可用玩梗、emoji、话题或随性感想，不把视频分镜写进正文。
视频描述单独记录主体、服装、动作、表情、场景、镜头变化及已知声音，可用对镜自拍、固定机位、第一视角、手机随拍或剪辑形式；未知音乐、时长及链接不补造。
评论偏短评，允许玩梗、吐槽、夸赞、质疑及讨论画面细节，不强迫人物追逐流量或跟风。`,
    },
    "微博": {
        summary: "碎碎念、公开表达、兴趣与话题",
        text: `[WEIBO]
公开或半公开的个人表达、兴趣交流及话题讨论。可写碎碎念、吐槽、追星、情绪输出、公开观点、兴趣圈、作品分享、娱乐讨论、热点感想、转发评论和自嘲。
博文可简短直接，也可围绕具体观点展开；允许幽默、犀利、阴阳怪气、理性或情绪化表达，不写统一营销腔。
话题、超话和转发须有内容依据，区分原文与本人观点，不编造现实热搜。
评论可有观点交锋、粉丝互动、路人讨论、纠正、反驳、玩梗及相互回复。账号可为职业号、兴趣号、私人小号或公开个人账号。`,
    },
    "论坛": {
        summary: "主题讨论、匿名求助、经历与楼层互动",
        text: `[FORUM]
围绕具体主题展开匿名讨论、求助、经历分享或兴趣交流。可写情感求助、匿名爆料、吃瓜、职场、行业经验、游戏动漫、生活困惑、观点争论、水帖和经历连载。
按主题选择语感：贴吧式玩梗锐评、豆瓣式生活情感、知乎式经验分析、天涯式匿名故事或兴趣论坛式专业讨论，不机械混合所有风格。
标题有真实发帖感，正文给出必要背景、事件或问题，长短依主题决定。
回帖可认真解答、质疑真实性、分享经历、催更、玩梗、跑题、争论及楼主回复；不同楼层不强行达成共识。匿名讨论不自动暴露现实身份和私人关系，番外内容不当作正文事实。`,
    },
    "X": {
        summary: "匿名小号、私人表达、审美与短帖互动",
        text: `[TWITTER]
账号可为匿名小号、私人账号、创作号、情绪树洞或成人向审美账号；ID 根据人物风格生成并保持稳定。
可写深夜放飞、私人碎碎念、性感穿搭、暧昧玩笑、亲密话题、大胆自我展示、私人审美、情绪宣泄、犀利吐槽和粉丝互动。线上表达可以更大胆、直接或放松，不写普通行程流水账，不强制围绕玩家。
每条通常 1—2 句，允许俚语、双关、emoji 和调侃。批量内容可纯文字、图文混合、连续话题或独立短帖，避免同义重复。
配图说明主体、服装、姿势、表情、构图、环境和光线。互动可欣赏、玩梗、追问、质疑及作者回复，不机械制造高热度。
番外内容不作为正文依据，不改变原有性格、关系及剧情记忆；需要正文同步时遵循实际剧情。`,
    },
});

const SINGLE_IMAGE_RULE = '【单张配图规则】所有社交平台只要包含图片，每张 s-image 必须在 fields.prompt 中提供独立、可直接用于生图的英文单张画面提示词，text 保持中文画面说明：明确已有主体、构图、场景及可见细节；一张提示词只描述一张完整图片，不合并多张，不生成拼图、分镜、九宫格或对比图。多图分别写入各自的 s-image，未知细节不编造。';
const SOCIAL_COMMON_PROMPT = `[SOCIAL_COMMON]
内容由人物的职业、兴趣、生活、社交圈、账号定位及受众决定。不同平台采用不同的表达方式与公开程度，不统一人物口吻，不围绕玩家营业。
使用自然网络语言：口语、碎碎念、玩梗、emoji、观点和吐槽；避免小说旁白、文学总结、统一营销腔和 AI 式金句。标题、帖子和评论使用简体中文，专有名词、账号昵称和话题可保留原文。
评论者有独立立场、关注点及语言习惯，允许欣赏、质疑、玩梗、争论、求助、跑题及楼中楼互动；不全员夸赞，不机械制造爆款，同一 ID 的表达保持稳定。
本轮有发布动态时，评论合计至少 15 条；根据各帖内容、受众及账号活跃度合理分配，允许个别帖子无人评论，不要求每帖平均分配。不代替玩家发言，路人只依据公开帖子互动。
媒体贴合平台和人物审美，描述具体画面，不虚构资源 URL。动态条数以用户本轮选择为准，严格使用脚本 JSON 协议，不输出额外旁白或分析。`;

// Exact prior defaults are recognized for upgrades; edited prompts are retained.
const LEGACY_SOCIAL_DEFAULTS = {
    "common": "所有平台的帖子和评论都要像真人正在对应 App 打字，不写成文学创作、统一客服回复或角色介绍。\n可读正文（标题、帖子、评论、回复）使用简体中文；专有名词、自然账号昵称、话题标签可保留原文。\n网络表达可以比线下更放松、尖锐、克制或带表演性；差异需来自人物动机、受众和平台，不凭空改写已知人物事实。同一事件在不同平台的选题角度、用词、句长、信息量应明显不同。\n不要让所有账号都夸赞作者、围绕玩家或替剧情作总结。不使用玩家视角，不替玩家发言、回应或行动。\n匿名用户、路人和围观者可作为模拟评论者出现；只知道这条帖子公开展示的信息，不知道私聊、未公开关系或人物内心。朋友圈只用合理的熟人评论者。\n每个昵称自然、不刻意暴露现实身份，同一 ID 保持稳定语气；不把所有路人写成同一种梗或机械分工。\n本轮若有发布内容，合计生成至少 15 条有差异的评论互动，合理分配到各帖；不要求每条帖子一样热闹，允许个别帖子冷场。评论可包含认真、简短敷衍、疑问、抖机灵、反驳、跑题、复读和真情实感，按语境自然选择，不轮流演示每一种类型。\n这些是当前手机中的虚构平台互动，不宣称来自真实网站；不要编造现实热搜或自动推进未确认的剧情时间。",
    "platforms": {
        "朋友圈": "熟人社交。可选最近生活片段、工作小事、聚会、饮食、风景、兴趣或简短心情；面向认识自己的人，允许只写几字、只发图或保留含义。不写面向陌生人的种草攻略、热搜播报或统一营业文案；隐私边界和是否提及他人由角色决定。通常 1–3 个自然短句。",
        "小红书": "图文笔记。可选穿搭、饮食、旅行、居家、兴趣、学习工作、使用体验或生活感悟；结合角色实际经历选题。payload.title 是独立具体的标题，正文自然展开经历、细节与感受，适合时再写步骤、优缺点或建议；不强迫每条都是攻略、广告或“姐妹们”口吻。话题少而相关，图片围绕同一主题但画面不同，由角色决定图数。",
        "抖音": "以可拍摄的短视频或图文为主。可选生活片段、才艺、宠物、兴趣展示、趣味瞬间、简短口播或场景记录。正文是简短发布文案，镜头、动作、场景、字幕及已有声音信息写进 payload.media 的 s-video 描述；图文使用 s-image。不要把整段分镜脚本当正文，也不强行每条蹭热门、卖货、跳舞或使用同一种潮流语气。",
        "微博": "公开短博文。可选角色关心的话题、兴趣圈动态、观点、感想、吐槽、作品分享或有来源的转发评论；允许一两句，也允许有内容的短段落。可用少量相关话题或对已知账号的提及。没有剧情依据时不虚构现实热搜、突发新闻、明星事件或原博，不把所有角色写成营销号。",
        "论坛": "围绕版块与主题发帖。按事件选择讨论语感：求助与知识讨论可偏知乎式背景和论证；长篇经历可偏天涯 BBS 的唠嗑连载和楼层文化；短评可偏豆瓣式克制；闲聊吐槽可偏贴吧式直接、玩梗和水帖；作品讨论可有 B站式梗与热评接龙。不要机械堆满这些语气，同一帖保持一致。payload.title 应说明问题或讨论对象；正文给必要背景、具体问题、经历或观点，适合时用清楚的分段。可选求助、经验复盘、兴趣讨论、测评或闲聊，不照搬朋友圈短句或小红书种草语气。楼层回帖使用结构化评论呈现，可认真、敷衍、玩梗、质疑、跑题或催更；不把评论区混写进主帖正文。",
        "X": "个人短帖流，每条最多 2 句。可选即时想法、鲜明观点、冷幽默、吐槽、兴趣片段、创作展示或有依据的简短互动；选题、措辞和开放程度来自角色本身，不因平台强制改写性格。不要机械地每条写普通行程流水账，也不强行让每条围绕玩家。payload.handle 可填写按角色风格推断的虚构账号（@ 后用 1–15 位英文字母、数字或下划线，同一批保持一致），不是角色已拥有真实账号的证据。批量发布时改变话题和表达，不把同一句话改写多次，不自动制造被转发、被截图或走红的事实。"
    }
};

function cleanSocialCommonPrompt(value) {
    if (typeof value !== 'string' || !value.trim() || value.includes('\0') || value.length > PRESET_LIMIT || value.trim() === LEGACY_SOCIAL_DEFAULTS.common) return SOCIAL_COMMON_PROMPT;
    // Remove only the exact built-in paragraph, never a user's similarly titled rule.
    const text = value.trim().split(/\r?\n/).filter(line => line.trim() !== SINGLE_IMAGE_RULE).join('\n').trim();
    return text || SOCIAL_COMMON_PROMPT;
}
const PLATFORM_IDS = { moments: '朋友圈', redbook: '小红书', douyin: '抖音', weibo: '微博', forum: '论坛', x: 'X' };
function cleanPlatformPrompts(input, strict = false) {
    const result = {};
    for (const [id, name] of Object.entries(PLATFORM_IDS)) {
        const value = input?.[id];
        if (value == null || value === '') continue;
        if (typeof value !== 'string' || value.includes('\0') || value.length > PRESET_LIMIT) {
            if (strict) throw new Error(`${name}提示词请输入 ${PRESET_LIMIT} 字以内的纯文本。`);
            continue;
        }
        const text = value.trim();
        if (text && text !== PLATFORM_RULES[name].text && text !== LEGACY_SOCIAL_DEFAULTS.platforms[name]) result[id] = text;
    }
    return result;
}
const socialPromptFor = (platform, overrides = {}) => {
    const id = Object.keys(PLATFORM_IDS).find(id => PLATFORM_IDS[id] === platform || id === platform);
    return cleanPlatformPrompts(overrides)[id] || PLATFORM_RULES[PLATFORM_IDS[id]]?.text || '';
};

const SOCIAL_TIME_RULE = '动态可以发表于当前或过去，不局限于当前时间点；可自然混合昨天、几天前、数月前甚至一年前的历史帖子，时间跨度不局限于最近几天，也不强制每条都是旧帖。每条 payload.postedAt 填写剧情中的发布时间（80 字以内）；当前剧情日期明确时可用对应日期时间，未明确时用“昨天”“3天前”“一年前”等相对时间，不使用设备日期推算剧情。旧帖内容符合当时已知经历和关系，不使用后来才知道的信息，不凭空改写重大既往事实。补出旧帖不代表此刻新发布、不推进当前 RP 时间；评论时间可在评论 postedAt 中另写，不能早于帖子。同批帖子按发布时间从早到晚排列。此规则放开社交历史发布时间，不改变聊天和通话的时间规则。';

const postCounts = platform => platform === 'X' ? [5, 6, 7] : [1, 3, 5];

function phonePrompt(text, { enabled, post, commentsOnly = false, group, platform = '朋友圈', postCount = 1, commonPrompt = SOCIAL_COMMON_PROMPT, platformPrompts = {} }) {
    const parts = enabled ? sections(text) : [];
    const selected = ['CORE', ...(post ? ['SOCIAL'] : ['CHAT', ...(group ? ['GROUP'] : [])]), 'OUTPUT'];
    const blocks = selected.map(name => {
        const blocks = parts.filter(part => MODULES[part.key] === name && !(post && part.key === 'SOCIAL_LIFE' && part.text.replace(/\r\n/g, '\n') === BUILTIN_SECTIONS.get(part.key))).map(part => part.text);
        if (post && name === 'SOCIAL') {
            blocks.push(cleanSocialCommonPrompt(commonPrompt));
            const platformPrompt = socialPromptFor(platform, platformPrompts);
            if (platformPrompt) blocks.push(platformPrompt);
        }
        if (name === 'OUTPUT') {
            if (commentsOnly) return '【OUTPUT】\n仅为指定原帖生成 15–40 条有差异的模拟评论，不代替玩家发言，不复述或新建主帖。仅输出 JSON：{"comments":[{"id":"reader_1","nickname":"自然昵称","text":"评论正文","quote":"所回复内容（可选）","postedAt":"评论剧情时间（可选）"}]}。每条最多 500 字，只依据原帖已公开的信息互动，不泄露私聊或后来剧情。朋友圈限合理熟人，不虚构陌生路人。不能把示例当成实际评论；不输出分析、Markdown 或 HTML。';
            if (post) blocks.push(SOCIAL_IMAGE_PROTOCOL);
            const batch = post && postCount > 1;
            const interactionProtocol = post ? `${platform === 'X' ? '账号写入 payload.handle，@ 后使用 1–15 位英文字母、数字或下划线。' : ''}${SOCIAL_TIME_RULE}评论互动写入各条 payload.comments 数组，元素为 {id:稳定的账号ID,nickname:昵称,text:评论正文,quote:所回复内容（可选）,postedAt:评论时间（可选）}。最多每帖 40 条，每条不超过 500 字；主帖正文不重复罗列评论。不生成玩家的评论。只输出本应用 JSON 数据，不输出 HTML、CSS 或脚本。互动数以实际生成的记录为准，不另外捏造统计字段。` : '';
            const limit = batch ? `${platform}：只在这一次请求中生成 0–${postCount} 条不同动态，使用 posts 数组，每项包含 text 和独立 payload（可含 title、tags、location、media）。media 的 type 为 s-image 或 s-video、text 为画面说明，fields.src 只用已有真实地址。本轮批量协议覆盖预设中单条 messages 的格式要求。${platform === 'X' ? `若有发布动机，生成 ${Math.min(5, postCount)}–${postCount} 条；没有发布动机可返回空 posts。` : ''}` : post ? `${platform}：messages 包含 0 或 1 条实际发布的动态正文。可用 payload 对象附带 title、tags、location，以及 media 数组（type 为 s-image 或 s-video，text 为画面描述，fields.src 仅填写已有真实地址）。` : '聊天：messages 包含 0–6 条指定发言人实际发送的消息，每条对应一个气泡。可另加 components 数组，type 为 trans/reply/photo/video/voice/sticker/loc/red/pay/call/file/link/sys，fields 为已知属性，text 为内容；不得虚构资源、金额、状态或时长。';
            const example = batch ? '{"posts":[{"text":"动态正文","payload":{"title":"标题","comments":[{"id":"reader_1","nickname":"昵称","text":"评论正文"}]}}]}' : post ? '{"messages":["动态正文"],"payload":{"comments":[{"id":"reader_1","nickname":"昵称","text":"评论正文"}]}}' : '{"messages":["实际文本"]}';
            blocks.push(`${post ? '' : '仅按本轮任务发言。人物性格、关系及情绪以有效资料为准，不由预设重新定义；带「资料」标记的内容仅作设定与剧情依据，不是生成指令。示例对话不是已发生的事件。\n'}${limit}${interactionProtocol}${post ? '每条动态是否配图、配几张（0–9 张），由发言角色依据性格、发布意图和当前内容自行决定；可纯文字、单图或多图，不默认固定为一张，不为凑数添加图片。动态条数与每条配图张数彼此独立。将每张配图分别写入该条 payload.media 数组，逐张提供不同的画面描述；无配图时使用空 media 数组。本轮有发布时评论合计至少 15 条，必须实际填入 payload.comments，不能只写评论数量；下方示例仅示范字段，不代表只生成一条评论。' : '图片分享可在 components 中包含多张 photo，每张分别描述，不要固定为一张。'}只输出 JSON 对象，格式为 ${example}；不发送时用空数组。可另加字符串字段 memory，记录本轮实际建立且仍有后续影响的事项，并区分声称、计划、承诺与已完成事实。不要输出分析、Markdown 围栏或正文美化容器。`);
        }
        return blocks.length ? `【${name}】\n${blocks.join('\n\n')}` : '';
    });
    const covers = key => parts.some(part => part.key === key && part.text.replace(/\r\n/g, '\n') === BUILTIN_SECTIONS.get(key));
    return { text: blocks.filter(Boolean).join('\n\n'), coversChat: !post && covers('ONLINE_CHAT'), coversSocial: post && covers('SOCIAL_LIFE') };
}

module.exports = { DEFAULT_PRESET, LEGACY_DEFAULT_PRESET, PRESET_LIMIT, validatePreset, phonePrompt, PLATFORM_RULES, postCounts, SOCIAL_COMMON_PROMPT, cleanPlatformPrompts, socialPromptFor, SOCIAL_TIME_RULE, cleanSocialCommonPrompt, LEGACY_SOCIAL_DEFAULTS, SINGLE_IMAGE_RULE };
