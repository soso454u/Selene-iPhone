const IMAGE_RULES_LIMIT = 40000;
const LEGACY_IMAGE_RULES = `【IMAGE GENERATION RULES】

Generate accurate, clear, and visually expressive English image prompts based on the current story, character settings, social posts, and all available context.

1. Scene Understanding
First determine what the image should actually depict, including the main subject, location, action, state, environment, and lighting.
Convert the narrative into a specific visible moment rather than mechanically translating the entire text.
Prioritize details that are distinctive, narratively meaningful, and visually appealing.

2. Character Consistency
Accurately identify the characters appearing in the image and preserve their known appearances.
Different characters must keep their own facial features, hairstyle, hair color, eye color, body type, and other distinguishing traits.
Clothing, accessories, and physical state must follow the current story context.
Do not mix features from different characters or arbitrarily change already established appearances.

3. Scene and Composition
Choose the framing naturally according to the content of the image, such as wide shot, medium shot, upper body, close-up, or detail shot.
The number of characters should depend on the actual scene; do not force every image into a single-character portrait.
For two-character or multi-character interactions, clearly reflect their relative positions, actions, and lines of sight.
If the scene is only showing a partial detail, preserve that partial composition instead of expanding it into a full-character portrait.
Choose an appropriate camera angle, depth of field, and subject placement according to the narrative.

4. Actions and Expressions
Translate the specific actions in the narrative into visible poses and body language.
Expressions should reflect the current emotion and personality of the character, without defaulting to smiling, blank stares, or looking at the camera.
For interactions, clearly describe the point of contact, body orientation, the initiator, and the receiver.
Prefer poses that are natural, expressive, and anatomically believable.

5. Scene Continuity
Follow the current location, time, weather, clothing, and all already established environmental information.
If some details are unknown, simplify them appropriately rather than inventing unnecessary specifics.
Do not automatically turn dim scenes, old buildings, or unusual lighting into horror imagery or exaggeratedly eerie visuals.
Preserve natural facial structure and reasonable lighting relationships on the characters.

6. Prompt Organization
Use Danbooru-style English tags that are easy for NAI to understand.
Organize prompts in the following order: subject, appearance, clothing, action, expression, interaction, composition, environment, lighting, and key visual details.
Prefer tags that are accurate, explicit, and visually meaningful.
For complex interactions, short English phrases may be used as supplements.
Reduce redundant synonyms, conflicting tags, or details unrelated to the image.
Each image should be described independently so that the subject, composition, and visual information remain clear and coherent.

7. Style Handling
These image generation rules are mainly responsible for scene content and composition.
Specific art style, skin texture, color aesthetics, and quality tags should be controlled by separate style prompts.
Do not automatically override the user’s existing style settings.`;

const LEGACY_PROMPT_WRITING_RULES = `【IMAGE PROMPT WRITING RULES】

Generate clear, concrete, visually grounded English image prompts in a Danbooru-style / prompt-style format.

Focus on what is actually visible in the image.

1. Subject First
Always identify the main visible subject at the beginning of the prompt.
The first 1–2 segments must clearly establish what the image is mainly showing.
Do not start with vague atmosphere words before the subject is clear.

2. Visible Content Only
Describe what is actually visible, not what is merely implied.
If only part of a person is shown, describe only that visible part.
If the face is not visible, explicitly state that no face is shown.
Do not invent missing body parts, expressions, or full character portraits when the scene only shows a partial view.

3. Concrete Scene Description
Describe the image as a visible scene, using short English prompt-style phrases.
Use concrete visual elements: subject, pose, framing, environment, lighting, screen content, objects, and mood.
Prefer direct prompt phrasing over abstract explanation.

4. Composition Priority
Clearly state the framing and composition:
close-up, upper body, partial view, foreground, background, from behind, cropped composition, over-the-shoulder, blurry foreground, etc.
If the image is focused on an object, screen, hand, hair, or back view, make that the visual center of the prompt.

5. Character Consistency
If a known character appears, preserve their established appearance.
Keep each character’s facial features, hairstyle, hair color, eye color, body type, and clothing consistent with the current context.
Do not mix multiple characters’ features together.

6. Action and State
Describe the current visible action or state clearly.
Use specific visual actions instead of generic standing/sitting whenever possible.
If the image is static, describe the visible condition or posture precisely.

7. Environment and Lighting
State the location and lighting in simple, visual terms.
Examples: dimly lit indoor scene, warm screen light, evening street, soft daylight, cluttered bedroom, cozy room.
Lighting should support the subject, not replace it.

8. Prompt Style
Write in concise English prompt-style phrases separated by commas.
Danbooru-style tags and natural English visual phrases can be mixed together.
Use the most important visual information first.
Avoid long explanatory sentences.

9. Avoid Subject Loss
Do not let atmosphere, style, or background overpower the subject.
The prompt must always make it obvious what the viewer is supposed to see.

10. Style Separation
This rule set controls image content and composition only.
Art style, rendering quality, skin texture, and aesthetic style should be controlled separately by style prompts.`;

const DEFAULT_IMAGE_RULES = `<IMAGE_GENERATION_RULES>
Generate accurate, detailed, and visually descriptive English image prompts based on the current narrative, character profiles, social media content, and established context.

Use a natural combination of Danbooru-style tags and concise descriptive English phrases. The final prompt should read like a clear visual description of an actual image, not merely a collection of isolated keywords.

1. VISUAL SUBJECT
Identify the actual visual subject of the scene.

The subject may be a person, multiple characters, an object, an environment, a particular body part, or a specific interaction.

Clearly establish what the viewer should see.

Prioritize the main subject and its defining visual details. Do not let generic atmosphere, decorative details, or background descriptions replace the actual subject.

If the scene focuses on an object or a partial view, preserve that composition rather than automatically generating a character portrait.

2. SCENE INTERPRETATION
Translate the narrative into a specific, visually observable moment.

Determine:
- What is visible in the image?
- Who or what is the main subject?
- What is happening at this exact moment?
- Where is the subject positioned?
- What surrounding objects and environmental details are visible?
- What is the actual lighting condition?

Describe these elements directly and concretely.

Preserve meaningful details from the original narrative, including colors, materials, clothing construction, spatial relationships, gestures, and environmental characteristics.

Do not replace specific details with generic descriptions.

3. CHARACTER CONSISTENCY
Identify all visible characters and preserve their established appearances.

Maintain each character's distinctive facial features, hairstyle, hair color, eye color, body proportions, and other known characteristics.

Use the clothing, accessories, physical condition, and hairstyle established in the current context.

For multiple characters, distinguish their appearances, positions, actions, and interactions.

Do not merge the features of different characters or arbitrarily alter established details.

4. ACTIONS AND EXPRESSIONS
Describe specific visible actions, gestures, postures, and facial expressions.

Translate narrative actions into concrete visual descriptions rather than generic poses.

For interactions, describe who is performing the action, who or what is receiving it, and their relative physical positions.

Expressions should reflect the current narrative and character personality.

Do not automatically assign smiling expressions, direct eye contact, or static poses.

5. COMPOSITION AND CAMERA
Choose the framing that best represents the intended scene.

Use appropriate visual descriptions such as:
full body, upper body, close-up, side view, profile, from behind, over-the-shoulder view, foreground, background, partial view, cropped composition, candid shot, depth of field.

Clearly describe the spatial arrangement of important subjects and objects.

If only a head, hand, silhouette, back view, or clothing detail is visible, preserve that limited framing.

Do not invent unseen faces or expand partial subjects into complete portraits.

Keep the composition natural and visually coherent.

6. ENVIRONMENT AND MATERIALS
Describe the actual location and relevant surrounding details.

Include visible furniture, architecture, decorations, objects, fabrics, textures, and environmental features when they contribute to the image.

Preserve specific material descriptions, such as merino wool, silk, cotton, velvet, leather, glass, or polished wood.

Describe how materials visually appear under the current lighting.

Keep background details consistent with the scene instead of introducing unrelated decorative elements.

7. LIGHTING AND ATMOSPHERE
Identify the scene's actual light sources and their visible effects.

Describe how light falls on the subjects, clothing, materials, and surrounding environment.

Use specific visual phrases such as:
soft afternoon sunlight, warm reflected light, diffused window light, dim indoor lighting, gentle fabric sheen, subtle shadows, natural highlights.

Atmosphere should emerge from the location, lighting, colors, and visible details.

Do not automatically turn dark environments into horror scenes or bright environments into generic portrait photography.

8. PROMPT WRITING STYLE
Write the final image prompt entirely in English.

Use comma-separated Danbooru-style tags combined with natural descriptive phrases.

Prefer concrete visual descriptions over abstract aesthetic adjectives.

A useful general structure is:

main subject, visible appearance, clothing and materials, action or posture, framing and camera angle, surrounding environment, lighting and material reflections, distinctive visual details, atmosphere

Adapt this structure naturally to the scene. Not every image requires every category.

Keep important spatial relationships within the same descriptive phrase when this improves clarity.

Do not unnecessarily shorten rich visual descriptions into generic tags.

Avoid excessive repetition, contradictory details, irrelevant objects, and vague filler words.

9. VISUAL ACCURACY
Preserve the defining information of the original scene.

Do not omit important subjects, actions, materials, or environmental details merely to make the prompt shorter.

Do not invent additional characters, facial features, outfits, or actions that contradict the established context.

If information is unknown, use a natural, restrained description rather than fabricating unnecessary specifics.

Each prompt must describe one clear, coherent visual moment.

10. ART STYLE
These rules control image content, visual interpretation, and composition.

Rendering style, artistic technique, skin texture, color grading, and quality-related settings are controlled separately by the user's art-style prompts.

Preserve the existing visual style without replacing it with an unrelated aesthetic.
</IMAGE_GENERATION_RULES>`;

function imageRules(value) {
    if (value === LEGACY_IMAGE_RULES || value === LEGACY_PROMPT_WRITING_RULES) return DEFAULT_IMAGE_RULES;
    return typeof value === 'string' ? value.slice(0, IMAGE_RULES_LIMIT) : DEFAULT_IMAGE_RULES;
}
const isEnglishPrompt = value => typeof value === 'string' && !!value.trim() && !/[^\p{Script=Latin}\P{Letter}]/u.test(value);

// The media protocol stays separate from editable scene rules.
const SOCIAL_IMAGE_PROTOCOL = '仅在本轮动态实际配图时使用生图规则，不因规则要求添加图片。每个 s-image 的 text 为中文画面说明，fields.prompt 为同一画面的独立英文生图提示词；多图逐项描述，不把不同图片合并成拼图或分镜。保留用户明确指定的画风与构图；无图时不生成图片条目。';

const IMAGE_DRAFT_PROTOCOL = '只为用户准备一张图片的文字草稿，不发送消息、不生成图像、不推进剧情。仅输出 JSON：{"description":"中文画面说明","prompt":"同一画面的英文生图提示词"}。已有画面说明时保持同一主体、动作与构图，只生成对应英文提示词；说明为空时依据可见剧情和用户要求拟定可编辑的画面。这是用户主动请求重新生成：即使已有完整英文提示词，也要按照画面说明与生图规则重新组织英文词，旧词只作参考，不直接回显旧词；保持已有主体、互动、构图和明确画风，不为制造差异编造新场景。外貌参考按姓名分别对应，只使用实际出镜人物；保留用户画风。不要输出分析、Markdown 或规则原文。';

module.exports = { DEFAULT_IMAGE_RULES, LEGACY_IMAGE_RULES, LEGACY_PROMPT_WRITING_RULES, IMAGE_RULES_LIMIT, imageRules, isEnglishPrompt, SOCIAL_IMAGE_PROTOCOL, IMAGE_DRAFT_PROTOCOL };
