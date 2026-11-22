# Mandarin Chinese (zh) lessons 11-30: curriculum plan

Status: research and plan only. No lesson JSON written. Lessons zh-01..zh-10 exist in `src/data/content/zh/part1.json`.

## Sources (pages actually read)

1. https://studycli.org/hsk/hsk-levels-guide/ - cumulative word counts for HSK 2.0 (150/300/600) and the revised 3.0 syllabus (300/500/1,000 for levels 1-3); says the 2.0 and 3.0 labels do not map to each other, and that 3.0 launches 13 Dec 2026.
2. https://en.wikipedia.org/wiki/Hanyu_Shuiping_Kaoshi - HSK 2.0 (2010) vs the 2021 3.0 standard (500/1,272/2,245 cumulative words for levels 1-3; 572 grammar points in total) and the 2025 revision that lowered beginner word counts. Also the CEFR-equivalence dispute.
3. https://resources.allsetlearning.com/chinese/grammar/A1_grammar_points - the 40 Chinese Grammar Wiki A1 points (measure word 个, 在/有, 想/要/会/能/可以, 没 negation, 吗/呢/吧 and so on). Used to avoid repeating lessons 1-10.
4. https://resources.allsetlearning.com/chinese/grammar/A2_grammar_points - the 99 A2 points (了, 过, 比, 一样, 着 via 在, 因为…所以, 会/要/应该, 还是/或者, duration with 了, 得/不 complements, 从…到, and so on). Main backbone for lessons 11-20.
5. https://resources.allsetlearning.com/chinese/grammar/B1_grammar_points - B1 points: 把, 被, directional/result/potential complements, 虽然…但是, 如果…就, 着, 越来越. The reference for lessons 21-29. It has no 过 or duration entry, so those are placed from A2/coursebook evidence instead.
6. https://knowt.com/note/3ad9d708-5f62-4fb4-a19c-0167088e63e4/HSK-Standard-Course-3---Exhaustive-Study - lesson-by-lesson themes and grammar of HSK Standard Course 3 (20 lessons: 着, 了 for change, potential complements, duration, 比, 把, compound directionals, 如果…就, 被). It confirms that 把 and 被 sit at roughly HSK 3 and so should be "introductory" for us.
7. https://en.wikipedia.org/wiki/Tone_sandhi - third-tone sandhi and 不/一 tone changes; its examples write the changed tones (ní hǎo, bú shì, yí cì).
8. Search-result summaries (not full pages): the Purple Culture and Newcastle Confucius Institute listings of HSK Standard Course 3 titles (周末你有什么打算, 桌子上放着很多饮料, 我最近越来越胖了, 我被他影响了), and Integrated Chinese Level 1 lesson topics (greetings, family, dates/time, hobbies, visiting friends, appointments, studying Chinese, school life, transportation). These informed topic order only.
9. Tried but unusable: https://prepedu.com/en/blog/hsk-vocabulary (blog index with no vocabulary data) and the Nottingham Confucius Institute course-book PDF (binary, text not extractable).

Counted as read: 7 pages (items 1-7) plus search snippets (item 8). The Cheng & Tsui, CTI and CLEC pages were not fetched. Word counts and coursebook contents below are therefore secondary-source level, and the vocabulary lists are my own judgement of high-frequency words, not copied from an official list. They should be spot-checked against the official HSK 2.0/3.0 lists before publishing.

## Decisions

- **HSK versions disagree.** Cumulative words for levels 1-3 are 150/300/600 (HSK 2.0), 500/1,272/2,245 (2021 3.0), and 300/500/1,000 (post-2025 3.0 revision, per studycli). Do not quote "HSK 3 = X words" in the UI without naming the version. The plan is anchored to grammar and topics, which are stable across versions, and not to word counts.
- **Level mapping.** Lessons 11-20 (`elementary`) cover HSK 2.0 level 2 / Chinese Grammar Wiki A2 grammar and topics. Lessons 21-30 (`intermediate`) reach HSK 2.0 level 3 / Grammar Wiki B1 entry grammar (把, 被, result/potential complements, conjunction pairs). Each lesson only has 6-8 headline words (about 150 across 20 lessons), so the app teaches roughly the grammar and topics of HSK 3 but nowhere near its 600-1,000 words. Dialogues can recycle extra words, but the app should not claim HSK 3 vocabulary coverage.
- **Progression.** Count-and-describe things (measure words), then modals, then aspect (在, 了-change, 了-completion + 过, 着), then comparison and duration, then place and movement (home, city, directionals). Lessons 21-30 add functional situations (food, pay, phone, work, school, doctor, travel, festivals) and clause-linking grammar (因为…所以, 虽然…但是, 如果…就). Lesson 29 is repair language, and 30 is a review.
- **Tone sandhi / 一 / 不.** Existing lessons 1-10 write dictionary tones in `translit` (nǐ hǎo, bù kèqi) and explain sandhi in prose. Keep that. Lessons 11+ should write dictionary tones for words (一样 yīyàng, 一直 yīzhí) and mention the sandhi spoken form in the hint only when it matters (不是 → bú shì, 一个 → yí gè, 一点儿 → yìdiǎnr). A human should confirm that this is the intended convention, because TTS and the audio pipeline will pronounce sandhi regardless.
- **Simplified characters only.** No traditional variants. Pinyin uses tone marks and attaches neutral-tone syllables without a tone mark (xǐhuan, míngbai). Proper nouns are capitalised (Wēixìn, Chūn Jié).
- **把 and 被.** 把 is introduced as a pattern (verb + result, with a fixed set of verbs) in 22, and 被 only for recognition in 23. Neither is drilled for production. 把 and 被 are HSK 3 / B1, so any further depth belongs in later parts.
- **Recycling.** Each lesson reuses vocabulary and patterns from earlier ones (e.g. measure words from 7, 在/有 from 8, times from 9, 想/要/请 from 6, 不/没 from 10), as noted in each lesson.
- **Cultural accuracy flags.** Mobile payment (支付宝/微信支付) and 高铁 are everyday in mainland China, so the plan assumes mainland usage. 中秋节 and 春节 content stays factual, with no claims about a single "correct" custom. Dish names are widely known mainland dishes.

## Lesson overview

| id | Title | Level | Topic slug | Main grammar |
|---|---|---|---|---|
| zh-11 | Measure Words in Depth | elementary | measure-words-things | Specific measure words and 这/那 + number + measure word |
| zh-12 | What I Can Do | elementary | abilities-permission | 会 / 能 / 可以 / 应该 |
| zh-13 | Hobbies and Sports | elementary | hobbies-sports | 在 / 正在 + verb (+ 呢) |
| zh-14 | Weather and Seasons | elementary | weather-seasons | Sentence-final 了 for change of state |
| zh-15 | Clothes and Colours | elementary | clothes-colours | 的 structures (adj/noun + 的 + noun, 的 on its own) |
| zh-16 | Comparing Things | elementary | comparisons | 比, 一样, 没有 |
| zh-17 | Things I Have Done | elementary | past-experiences | Verb + 了 vs Verb + 过 |
| zh-18 | How Long, How Often | elementary | duration-frequency | Duration and frequency after the verb |
| zh-19 | My Home | elementary | home-furniture | Place + verb + 着 + noun |
| zh-20 | Getting Around the City | elementary | city-transport | Directional complements 来/去 (introductory) |
| zh-21 | Eating Out: Chinese Dishes | intermediate | restaurant-dishes | 还是 vs 或者 |
| zh-22 | Shopping Online and Paying by Phone | intermediate | online-shopping-payment | 把-sentences (introductory) |
| zh-23 | Phone and WeChat | intermediate | phone-wechat | Result complements (看见, 听懂, 找到); 被 recognition |
| zh-24 | Work Life | intermediate | work-jobs | 因为…所以… |
| zh-25 | Studies and Exams | intermediate | studies-exams | 虽然…但是… |
| zh-26 | At the Doctor | intermediate | doctor-health | 如果…就… |
| zh-27 | Travel and Hotels | intermediate | travel-hotel | 快要…了 / 就要…了 |
| zh-28 | Festivals: 春节 and 中秋节 | intermediate | festivals | 是…的 |
| zh-29 | Say That Again? Clarifying | intermediate | clarification-repair | Potential complements 得/不 |
| zh-30 | Review: A Trip to Beijing | intermediate | review-trip | Cumulative contrast (no new grammar) |

## Lessons

### zh-11 Measure Words in Depth (elementary, `measure-words-things`)
- **Grammar:** Beyond 个/杯/瓶, nouns take specific measure words (本 for books, 张 for flat things, 条 for long things, 只 for small animals), and 这/那 + (number) + measure word points to a thing: this builds directly on zh-07 and makes counting precise.
- **Words:** 本 běn (measure word for books); 张 zhāng (measure word for flat things: tickets, paper, tables); 件 jiàn (measure word for clothes, matters); 条 tiáo (measure word for long things: fish, trousers, roads); 只 zhī (measure word for small animals); 辆 liàng (measure word for vehicles); 一些 yīxiē (some); 每 měi (every, each).
- **Cloze:** 我有两___猫。 answer 只 (wrong: 个, 本). This teaches that 只 is the measure for cats.
- **Conversation:** Showing a friend's flat: "这是我的书, 这是我的猫", counting books, cats and bikes with 一本书, 一只猫, 一辆车.
- **Recycles:** 个/杯/瓶 (zh-07), 我的 (zh-05), 有/没有 (zh-05).

### zh-12 What I Can Do (elementary, `abilities-permission`)
- **Grammar:** 会 for a learned skill, 能 for ability or circumstance, 可以 for permission, 应该 for "should": the four modal verbs come right after 想/要 (zh-06), and the choice between them is the key skill at this level.
- **Words:** 会 huì (can, know how to); 能 néng (can, be able to); 可以 kěyǐ (may, can); 应该 yīnggāi (should); 说 shuō (to speak); 汉语 Hànyǔ (Chinese language); 游泳 yóuyǒng (to swim); 开车 kāichē (to drive).
- **Cloze:** 我___说一点儿汉语。 answer 会 (wrong: 能, 可以). A learned skill needs 会.
- **Conversation:** A language-exchange meetup: "你会说汉语吗?" "会一点儿", plus asking "这里可以拍照吗?" at a museum.
- **Recycles:** 想/要 (zh-06), 不/没 (zh-10), 吗 (zh-05).

### zh-13 Hobbies and Sports (elementary, `hobbies-sports`)
- **Grammar:** 在 or 正在 before a verb (often with 呢 at the end) marks an action in progress, so "What are you doing?" gets a natural answer. The Grammar Wiki lists it at A2.
- **Words:** 喜欢 xǐhuan (to like); 爱好 àihào (hobby); 运动 yùndòng (sport, to exercise); 踢足球 tī zúqiú (play football); 打篮球 dǎ lánqiú (play basketball); 看电影 kàn diànyǐng (watch a film); 唱歌 chànggē (to sing); 跑步 pǎobù (to jog).
- **Cloze:** 他___踢足球呢。 answer 正在 (wrong: 正, 会). The progressive needs 正在/在.
- **Conversation:** A phone call: "你在做什么?" "我正在跑步呢。" and then inviting a friend to play basketball tomorrow.
- **Recycles:** 想 (zh-06), 明天 (zh-09), 会 (zh-12).

### zh-14 Weather and Seasons (elementary, `weather-seasons`)
- **Grammar:** 了 at the end of a sentence marks a new situation or change (下雨了, 冷了). It fits this topic and is the first use of 了 beyond 太…了 in zh-07. Also mention 越来越 as a bonus pattern.
- **Words:** 天气 tiānqì (weather); 下雨 xià yǔ (to rain); 下雪 xià xuě (to snow); 刮风 guāfēng (to be windy); 冷 lěng (cold); 热 rè (hot); 夏天 xiàtiān (summer); 冬天 dōngtiān (winter).
- **Cloze:** 下雨___, 我们回家吧。 answer 了 (wrong: 吗, 呢). Wrong options are question particles.
- **Conversation:** Packing for a trip: "北京今天天气怎么样?" "下雪了, 很冷。" "那我要带衣服。"
- **Recycles:** 太…了 (zh-07), 今天/明天 (zh-09), 要 (zh-06).

### zh-15 Clothes and Colours (elementary, `clothes-colours`)
- **Grammar:** 的 links a describer to a noun (红色的鞋, 我买的衣服) and can stand alone when the noun is understood (我要红的), extending zh-05's possessive 的.
- **Words:** 裤子 kùzi (trousers); 鞋 xié (shoes); 穿 chuān (to wear); 试 shì (to try); 颜色 yánsè (colour); 红色 hóngsè (red); 白色 báisè (white); 黑色 hēisè (black).
- **Cloze:** 我要红色___鞋。 answer 的 (wrong: 了, 吗). The pattern is describer + 的 + noun.
- **Conversation:** In a clothes shop: "这条裤子有别的颜色吗?" "有黑色的和白色的。" "我可以试一下吗?" and haggling with 便宜一点 (zh-07).
- **Recycles:** 件/条 (zh-11), 可以 (zh-12), 多少钱 (zh-07).

### zh-16 Comparing Things (elementary, `comparisons`)
- **Grammar:** A 比 B + adjective compares two things (他比我高), with 一样 for "the same" (跟…一样) and 没有 for "not as…as": comparison is high-frequency A2 grammar.
- **Words:** 比 bǐ (than, compared to); 更 gèng (even more); 最 zuì (most); 一样 yīyàng (the same); 高 gāo (tall, high); 快 kuài (fast); 慢 màn (slow); 远 yuǎn (far).
- **Cloze:** 他比我___。 answer 高 (wrong: 很高, 太高 as options). Teaches that 比 sentences do not take 很.
- **Conversation:** Comparing two cities (Cairo and Beijing) or two friends: "北京比开罗冷", "我的手机跟你的一样。"
- **Recycles:** 贵/便宜 (zh-07), 太…了 (zh-07), 了 for change (zh-14).

### zh-17 Things I Have Done (elementary, `past-experiences`)
- **Grammar:** 了 right after a verb marks a completed action (我买了一本书), and 过 marks "have ever done" (我去过长城), with 没(有)…过 for "never": the lesson contrasts the two in one pass.
- **Words:** 过 guo (have ever done); 已经 yǐjīng (already); 昨天 zuótiān (yesterday); 去年 qùnián (last year); 以前 yǐqián (before, in the past); 第一次 dì-yī cì (the first time); 上个月 shàng gè yuè (last month); 长城 Chángchéng (the Great Wall).
- **Cloze:** 我去___长城。 answer 过 (wrong: 着, 呢). This is experience, not an ongoing action.
- **Conversation:** Chatting with a new friend: "你去过长城吗?" "去过, 我去年去的 / 我没去过。"
- **Recycles:** 不/没 (zh-10), 今天/明天 (zh-09), 在 (zh-13).

### zh-18 How Long, How Often (elementary, `duration-frequency`)
- **Grammar:** Duration and frequency come after the verb (我学了两年汉语, 我一个星期去三次): the point is that, unlike time-when words (zh-09), these follow the verb, and the question is 多长时间.
- **Words:** 小时 xiǎoshí (hour); 分钟 fēnzhōng (minute); 次 cì (time, occasion); 常常 chángcháng (often); 一直 yīzhí (all along, continuously); 以后 yǐhòu (afterwards, later); 的时候 de shíhou (when); 多长时间 duō cháng shíjiān (how long).
- **Cloze:** 我学汉语学了两___。 answer 年 (wrong: 点, 号). Measure and duration words differ from point-in-time words.
- **Conversation:** A language-school intake: "你学了多长时间汉语?" "学了一年。" "一个星期上几次课?"
- **Recycles:** 几点 / 星期 / 起床 (zh-09), 汉语 (zh-12), 了 (zh-17).

### zh-19 My Home (elementary, `home-furniture`)
- **Grammar:** Place + verb + 着 + noun describes how things are placed (桌子上放着一本书), and combines with 在 and 有 from zh-08 while introducing 着 as a state marker.
- **Words:** 房子 fángzi (house); 房间 fángjiān (room); 客厅 kètīng (living room); 厨房 chúfáng (kitchen); 桌子 zhuōzi (table); 床 chuáng (bed); 门 mén (door); 放 fàng (to put, to place).
- **Cloze:** 桌子上放___一本书。 answer 着 (wrong: 过, 吗). The existential pattern needs 着.
- **Conversation:** A flat viewing: "客厅有沙发吗?" "有, 桌子上还放着花。"
- **Recycles:** 在/有 and location words (zh-08), measure words (zh-11), 大/小 and 比 (zh-16).

### zh-20 Getting Around the City (elementary, `city-transport`)
- **Grammar:** After a movement verb, 来 or 去 shows direction toward or away from the speaker (回来, 进去, 走过去). It is the introductory form of directional complements, and ends the elementary block.
- **Words:** 地铁 dìtiě (subway); 打车 dǎchē (to take a taxi); 高铁 gāotiě (high-speed rail); 公共汽车 gōnggòng qìchē (bus); 坐 zuò (to travel by, to sit); 换 huàn (to change, transfer); 回来 huílai (to come back); 进去 jìnqu (to go in).
- **Cloze:** 他在外面, 请他进___。 answer 来 (wrong: 去, 着). The speaker is inside, so the person moves toward the speaker.
- **Conversation:** Asking how to get to the airport: "怎么去机场?" "坐地铁, 在这儿换一次车, 比打车便宜。"
- **Recycles:** 地铁站 and 一直走 (zh-08), 比 (zh-16), 多长时间 (zh-18).

### zh-21 Eating Out: Chinese Dishes (intermediate, `restaurant-dishes`)
- **Grammar:** 还是 offers a choice in questions (你吃饺子还是面条?) and 或者 gives alternatives in statements (饺子或者面条都可以): the pair is a classic A1-A2 confusion point.
- **Words:** 服务员 fúwùyuán (waiter, waitress); 菜单 càidān (menu); 点菜 diǎn cài (to order dishes); 买单 mǎidān (to pay the bill); 饺子 jiǎozi (dumplings); 麻婆豆腐 Mápó dòufu (mapo tofu); 辣 là (spicy); 北京烤鸭 Běijīng kǎoyā (Peking duck).
- **Cloze:** 你喝茶___咖啡? answer 还是 (wrong: 或者, 和). Questions use 还是.
- **Conversation:** A group dinner: ordering from the menu, asking for less spice ("不要太辣"), and asking for the bill.
- **Recycles:** 想/要/请 (zh-06), 好吃 (zh-06), 会 (zh-12), 多少钱 (zh-07).

### zh-22 Shopping Online and Paying by Phone (intermediate, `online-shopping-payment`)
- **Grammar:** 把 moves the object before the verb when something is done to it (请把二维码给我, 我把东西放进购物车): introductory, fixed patterns only, because it is the first step into B1 grammar.
- **Words:** 网购 wǎnggòu (to shop online); 支付宝 Zhīfùbǎo (Alipay); 微信支付 Wēixìn zhīfù (WeChat Pay); 扫码 sǎo mǎ (to scan a code); 快递 kuàidì (express delivery); 打折 dǎzhé (to discount); 付款 fù kuǎn (to pay); 退货 tuì huò (to return goods).
- **Cloze:** 请___二维码给我。 answer 把 (wrong: 被, 在). Both wrong options are plausible particles.
- **Conversation:** Customer-service chat about a delayed parcel, or a shop assistant: "可以用微信支付吗?" "可以, 请扫这个码。"
- **Recycles:** 多少钱/便宜 (zh-07), 可以 (zh-12), 件/张 (zh-11), 了 (zh-17).

### zh-23 Phone and WeChat (intermediate, `phone-wechat`)
- **Grammar:** A result complement after the verb says the outcome (看见, 听懂, 找到, 打开). Recognition-only note: 被 marks passive events (手机被摔坏了), which previews the next steps.
- **Words:** 手机 shǒujī (mobile phone); 微信 Wēixìn (WeChat); 发消息 fā xiāoxi (to send a message); 看见 kànjiàn (to see, catch sight of); 听懂 tīngdǒng (to understand by listening); 找到 zhǎodào (to find); 打开 dǎkāi (to open); 被 bèi (passive marker).
- **Cloze:** 我没找___我的手机。 answer 到 (wrong: 着, 了). The result complement 到 means "found".
- **Conversation:** At a repair shop or with a friend: losing and finding a phone, "我的手机被摔坏了", "你看见我的手机了吗?"
- **Recycles:** 没/不 (zh-10), 把 (zh-22), 了 (zh-17), 在 (zh-13).

### zh-24 Work Life (intermediate, `work-jobs`)
- **Grammar:** 因为 gives the reason and 所以 the result (因为很忙, 所以不能去): the first of three clause-linking pairs, and it combines easily with 能/会 from zh-12.
- **Words:** 工作 gōngzuò (to work, job); 公司 gōngsī (company); 同事 tóngshì (colleague); 上班 shàngbān (to go to work); 下班 xiàbān (to finish work); 忙 máng (busy); 开会 kāihuì (to have a meeting); 因为…所以… yīnwèi… suǒyǐ… (because… so…).
- **Cloze:** 因为我很忙, ___不能去。 answer 所以 (wrong: 但是, 如果). The pair is 因为…所以.
- **Conversation:** Declining an after-work dinner: "你几点下班?" "因为要开会, 所以今天不能去。"
- **Recycles:** 起床/几点 (zh-09), 能 (zh-12), 一直 (zh-18), 坐地铁 (zh-20).

### zh-25 Studies and Exams (intermediate, `studies-exams`)
- **Grammar:** 虽然…但是… joins a concession and a contrast (虽然很难, 但是很有意思), and Chinese uses both words together.
- **Words:** 大学 dàxué (university); 专业 zhuānyè (major, field of study); 考试 kǎoshì (exam); 作业 zuòyè (homework); 容易 róngyì (easy); 难 nán (difficult); 复习 fùxí (to review, revise); 虽然…但是… suīrán… dànshì… (although… but…).
- **Cloze:** 虽然很难, ___我喜欢。 answer 但是 (wrong: 所以, 因为). The pair needs the contrast word.
- **Conversation:** Two classmates before an exam: "考试难不难?" "虽然很难, 但是我复习了两个星期。"
- **Recycles:** 因为…所以 (zh-24), 多长时间 (zh-18), 汉语 (zh-12), 比 (zh-16).

### zh-26 At the Doctor (intermediate, `doctor-health`)
- **Grammar:** 如果…就… gives a condition and its consequence (如果发烧, 就要吃药), the natural tool for medical advice and a step up from zh-10's one-line help phrases.
- **Words:** 感冒 gǎnmào (to catch a cold); 发烧 fāshāo (to have a fever); 咳嗽 késou (to cough); 药 yào (medicine); 休息 xiūxi (to rest); 严重 yánzhòng (serious); 如果 rúguǒ (if); 就 jiù (then).
- **Cloze:** 如果你发烧, ___去医院。 answer 就 (wrong: 但是, 所以). The consequence clause uses 就.
- **Conversation:** Visiting a doctor: symptoms for three days, "你发烧吗?" "如果还不好, 就再来。" and the doctor tells the patient to rest and drink water.
- **Recycles:** 我不舒服/头疼/医院/看医生 (zh-10), 应该 (zh-12), 多长时间 (zh-18), 因为…所以 (zh-24).

### zh-27 Travel and Hotels (intermediate, `travel-hotel`)
- **Grammar:** 快要…了 (or 就要…了) says that something is about to happen (飞机快要起飞了), building on the 了 patterns in zh-14 and zh-17.
- **Words:** 旅游 lǚyóu (to travel, tourism); 护照 hùzhào (passport); 机票 jīpiào (plane ticket); 订 dìng (to book); 酒店 jiǔdiàn (hotel); 行李 xíngli (luggage); 退房 tuì fáng (to check out); 快要 kuàiyào (about to).
- **Cloze:** 飞机快___起飞了。 answer 要 (wrong: 会, 能). The pattern is 快要…了.
- **Conversation:** At hotel check-in: booking, passport, room for three nights, asking the time for check-out.
- **Recycles:** 张 (zh-11), 房间 (zh-19), 三天 (zh-18), 坐高铁 (zh-20), 如果…就 (zh-26).

### zh-28 Festivals: 春节 and 中秋节 (intermediate, `festivals`)
- **Grammar:** 是…的 stresses the time, place or manner of a past event the listener already knows about (你是什么时候回家的?), a common pattern in family conversation.
- **Words:** 春节 Chūn Jié (Spring Festival); 中秋节 Zhōngqiū Jié (Mid-Autumn Festival); 月饼 yuèbǐng (mooncake); 红包 hóngbāo (red envelope); 放假 fàng jià (to have a holiday); 团圆 tuányuán (reunion); 祝 zhù (to wish); 过年 guò nián (to celebrate the New Year).
- **Cloze:** 我是坐高铁回家___。 answer 的 (wrong: 了, 吗). The pattern frames 是…的.
- **Conversation:** Asking a colleague about the holiday: "你是怎么回家的?" "我是坐高铁回家的。" "祝你春节快乐!"
- **Recycles:** 高铁 (zh-20), 回来 (zh-20), 已经 (zh-17), 比 (zh-16), 因为…所以 (zh-24).

### zh-29 Say That Again? Clarifying (intermediate, `clarification-repair`)
- **Grammar:** 得/不 inside a verb + result compound gives "can / cannot" (听得懂 and 听不懂), the potential complement built on the result complements of zh-23, and the backbone of repair language.
- **Words:** 什么意思 shénme yìsi (what does it mean); 怎么说 zěnme shuō (how do you say it); 慢一点儿 màn yīdiǎnr (a bit slower); 听不懂 tīng bu dǒng (cannot understand by listening); 听不清楚 tīng bu qīngchu (cannot hear clearly); 明白 míngbai (to understand); 写下来 xiě xiàlai (to write it down); 意思 yìsi (meaning).
- **Cloze:** 对不起, 我听___懂。 answer 不 (wrong: 没, 得). The negative potential is V + 不 + complement (听不懂).
- **Conversation:** A taxi or counter: "请说慢一点儿", "这个词是什么意思?", "你能写下来吗?"
- **Recycles:** 请再说一遍 and 我不懂 (zh-10), 能 (zh-12), 听懂 (zh-23), 汉语 (zh-12).

### zh-30 Review: A Trip to Beijing (intermediate, `review-trip`)
- **Grammar:** No new grammar. It contrasts 了, 过, 着 and 在 (zh-13/14/17/19), 把 and 被 recognition, and the three clause-linking pairs, all in context.
- **Words (recycled):** 订酒店 dìng jiǔdiàn; 坐高铁 zuò gāotiě; 点菜 diǎn cài; 微信支付 Wēixìn zhīfù; 听不懂 tīng bu dǒng; 如果…就… rúguǒ… jiù…; 虽然…但是… suīrán… dànshì…; 因为…所以… yīnwèi… suǒyǐ…. Six to eight of these appear as target items. Any new word should be limited to 复习 fùxí, already taught in zh-25.
- **Cloze:** 我去___长城, 很大。 answer 过 (wrong: 着, 正在); a review item contrasting aspect markers.
- **Conversation:** A chain scenario: booking a hotel, arriving by 高铁, ordering dinner, paying by phone, feeling ill, and asking someone to repeat what they said.
- **Recycles:** the whole of zh-11 to zh-29.

## Notes for the lesson author
- Make the English titles in the table the `title.en` values, with Arabic and Indonesian titles added at authoring time, as in part1.json.
- Check every pinyin item against a dictionary at authoring time. Neutral tones in this plan follow common dictionary usage (xǐhuan, míngbai, xíngli) and some dictionaries differ.
