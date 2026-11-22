# Egyptian Arabic (eg) curriculum plan, lessons 11-30

Research and planning only. No lesson JSON written. Transliteration follows `part1.json`: ʾ = glottal stop (Cairene qāf), ʿ = ʿayn, ḥ ṣ ḍ ṭ emphatics, gh, kh, sh, long vowels ā ī ū, ē and ō for ay/aw. `g` = jīm. Egyptian spellings follow part1 conventions (عايز, دلوقتي, ده).

## Sources

Pages actually read (content retrieved):

1. https://open.umn.edu/opentextbooks/textbooks/1571 - table of contents of the Oregon/UMN open textbook "Introduction to Arabic: Egyptian Arabic for First Year Students" (12 units: greetings, introductions, time, weather, housing, hobbies, family, question words, restaurant, daily routine).
2. https://soas.ac.uk/study/find-course/arabic-colloquial-egyptian-beginners-course - SOAS Beginners 1 and 2 outcomes. Beginners 2 = near-future, appearance/clothing/body, likes/dislikes, transport and tickets, time, routine, negation, advice, phones/internet, pastimes.
3. https://www.routledge.com/Arabiyyat-al-Naas-fii-MaSr-Part-One-An-Introductory-Course-in-Arabic/Younes-Weatherspoon-Huntley-Featherstone/p/book/9781138065154 - lesson-by-lesson grammar order of Arabiyyat al-Naas (negation mish/ma fīsh in L5, adjective agreement L6, possession and ʿand L7, singular/dual/plural L8, taxi, hotel, restaurant, housing, transport, weather, family/jobs, shopping, food/health, sports/hobbies; bitāʿ in unit 11; imperative with shopping).
4. https://aucpress.com/9789774162206/kallimni-arabi-bishweesh/ - Kallimni 'Arabi Bishweesh plan of modules (10 modules: greetings, objects, numbers/time/appointments, money/shopping, location, directions/places, habits/routines, jobs/visits/invitations, offers/gifts/likes, services/taxi/restaurant).
5. https://en.wikipedia.org/wiki/Egyptian_Arabic - verb system: past suffixes, b- present, ḥa- future, ma-...-sh negation, mish with future and negative questions, imperative, ʿand + suffixes, dual behaves as plural for agreement.
6. https://en.wikipedia.org/wiki/Common_European_Framework_of_Reference_for_Languages - A1 and A2 global descriptors used for level mapping.
7. https://www.fsi-language-courses.org/fsi-comparative-arabic-courses - read, but gave no unit list (only a Levantine/Egyptian comparative course); not used for sequencing.

Attempted and failed: the MEI syllabus PDF (HTTP 404, the URL in the brief seems stale), the Oregon textbook site itself (HTTP 403), a Five Colleges syllabus (404), Polyglot Club (403), CEFR coe.int (403). So the FSI/DLI unit lists, AUC Kullu Tamam and MEI were NOT verified. Lesson vocabulary below is written from knowledge of Cairene Arabic cross-checked against the sources' topics only, NOT against a dictionary: a native or dictionary review (e.g. Hinds and Badawi) is recommended before JSON is written.

## Decisions

- Level mapping: part1 eg-01..06 are `beginner` (about A1), eg-07..10 `elementary` (A1+). Lessons 11-20 (`elementary`) cover A1+ to A2.1: tenses, negation, possession, agreement, and concrete daily-life topics (SOAS Beginners 2 scope). Lessons 21-30 (`intermediate`) are A2 to low A2+: object pronouns, "want/must + verb", narration, social interaction, haggling, travel. Realistically a learner finishing eg-30 is a solid A2, not B1; the app label "intermediate" is a product label, not a CEFR claim.
- Progression: present (b-) -> past -> negation -> future -> imperatives/transport -> possession -> agreement/colours -> dual/plural/clothes -> comparatives -> body/health, then lexical-social lessons layered with one grammar point each (object suffixes, subjunctive after ʿāyiz/mumkin, question words, ʿashān, kān/lamma narration, numbers 11+, fīh/mafīsh, lāzim, illi/superlative). Every lesson has exactly one new grammar point plus a recycled one.
- Sources disagree on order. Arabiyyat al-Naas and Oregon teach negation, agreement, possession, dual early and past tense later; Kallimni and SOAS stay on the present and near future first. part1 already uses ʿandi (eg-04, eg-10), the mumkin/ʿāyiz frames and the ha- future in a fixed phrase (hākhud), so I put b- present first, then past (needed for stories), negation third and ha- future fourth. Past before future is the controversial call.
- Dual: all sources agree the dual (-ēn) exists on nouns but behaves as plural for agreement, so it is taught with clothes (pairs: gazmitēn) rather than as its own lesson. Adjective plural agreement rule used: non-human plurals take feminine singular adjectives (kutub kibīra).
- Spelling: عايز/عايزة (not عاوز), ha- written هـ attached (هروح), first person b- is ba- (bāshtaghal, bashūf), bitāʿ (بتاع) is transliterated bitāʿ to match the part1 style, not "betaaʿ".
- Overlaps with part1 handled: eg-08 already has simple commands (so eg-15 adds plural and negative imperative); eg-09 already touched past/present/future time words (so eg-11/12/14 give each tense real conjugation); eg-10 has ʿandi for symptoms (so eg-20 adds "X bitwagaʿni").

## Lesson table

### eg-11 Work and What I Do (present with b-)
- Level: elementary. Topic slug: `work`.
- Grammar: present tense is bi- (ba- for "I") + subjunctive stem: bāshtaghal, bitishtaghal, biyishtaghal. Why now: eg-03 gave one frozen form (bāshtaghal), and every later lesson needs the full paradigm.
- Vocabulary:
  - باشتغل في شركة | bāshtaghal fi sharika | I work in a company
  - بتشتغل فين؟ | bitishtaghal fēn? | where do you work?
  - مهندس | muhandis | engineer (f. muhandisa)
  - موظف | muwazzaf | employee, office worker
  - مدير | mudīr | manager
  - شغل | shughl | work, job
  - باروح الشغل | bāruḥ ish-shughl | I go to work
  - بيخلص | biykhalaṣ | it finishes
- Cloze: "هو ___ في بنك" (بيشتغل / باشتغل / بتشتغلي) tests the b- person prefix.
- Conversation: two colleagues meet at a wedding and ask where each works and when the shift ends.

### eg-12 Yesterday: Past Tense
- Level: elementary. Topic: `past-activities`.
- Grammar: past tense = stem + subject suffix (-t I/you, -na we, -u they, -it she). Why now: it unlocks storytelling and is needed before negation of the past.
- Vocabulary:
  - روحت | ruḥt | I went
  - أكلت | akalt | I ate
  - شربت | shribt | I drank
  - شفت | shuft | I saw
  - عملت إيه؟ | ʿamalt ēh? | what did you do?
  - رجعت | rigiʿt | I came back
  - وصلت | wiṣilt | I arrived
  - نمت | nimt | I slept
- Cloze: "امبارح ___ السوق" (روحت / باروح / هروح) with the time word imbāriḥ.
- Conversation: a friend asks "ʿamalt ēh imbāriḥ?" and the other tells a short sequence (went, ate, slept).

### eg-13 Likes, Dislikes and Hobbies (negation)
- Level: elementary. Topic: `hobbies`.
- Grammar: mish before adjectives/participles/prepositions; ma-...-sh around verbs (mabaḥibbish, maruḥtish). Why now: after present and past are known, negation can be taught across both (Wikipedia, Arabiyyat al-Naas L5 and SOAS all treat it as core).
- Vocabulary:
  - مش بحب | mish baḥibb | I don't like (also heard; see ma...sh)
  - ما بحبش الكورة | mabaḥibbish il-kōra | I don't like football
  - كورة | kōra | football
  - سباحة | sibāḥa | swimming
  - بلعب | balʿab | I play
  - باسمع موسيقى | bāsmaʿ mūsīʾa | I listen to music
  - ما رحتش | maruḥtish | I didn't go
  - مش فاضي | mish fāḍi | I'm not free
- Cloze: "أنا ___ بحب السباحة" (مش / ما / مفيش) with the answer ما…ش tested in a second item; the first item uses مش with an adjective.
- Conversation: a friend invites you to a football match; you politely decline and say what you like instead.

### eg-14 Plans and Appointments (future with ha-)
- Level: elementary. Topic: `plans`.
- Grammar: ha- + subjunctive for the future (haruḥ, hanitʾābil); negated with mish (mish haruḥ). Why now: a learner has tenses and negation, so appointments and plans are natural.
- Vocabulary:
  - هروح | haruḥ | I will go
  - ميعاد | mīʿād | appointment
  - بعد بكرة | baʿd bukra | day after tomorrow
  - الأسبوع الجاي | il-usbūʿ il-gāy | next week
  - هنتقابل | hanitʾābil | we will meet
  - مشغول | mashghūl | busy
  - أجازة | agāza | vacation, day off
  - إن شاء الله | inshāllāh | God willing
- Cloze: "___ نتقابل بكرة" (هـ / بـ / ما) tests ha- vs b-.
- Conversation: fixing a meeting time with a friend, one of them is busy and proposes baʿd bukra.

### eg-15 City Transport: Metro, Microbus, Taxi (imperatives)
- Level: elementary. Topic: `transport`.
- Grammar: imperative singular masculine/feminine/plural (istanna, istanni, istannu) and negative imperative with ma-...-sh (matinzilsh). Why now: giving instructions to a driver; extends eg-08's commands.
- Vocabulary:
  - ميكروباص | mikrubās | microbus
  - تاكسي | taksi | taxi
  - أجرة | ugra | fare
  - وقف هنا | waʾʾaf hina | stop here
  - اركب | irkab | get in
  - انزل | inzil | get out/off
  - استنى | istanna | wait
  - تذكرة | tazkara | ticket
- Cloze: "___ هنا لو سمحت" (وقف / بتوقف / هوقف).
- Conversation: you take a taxi, negotiate the fare, and ask the driver to stop at the corner.

### eg-16 My Home (possession with bitāʿ and ʿand)
- Level: elementary. Topic: `home`.
- Grammar: bitāʿ + suffix for "of/belonging to" (da bitāʿi, di bitāʿti), agreeing in gender and number with the thing owned; compare ʿandi. Why now: possession so far was only suffixes (eg-05) and ʿandi (eg-04, eg-10).
- Vocabulary:
  - شقة | shaʾʾa | apartment
  - أوضة | ōḍa | room
  - مطبخ | maṭbakh | kitchen
  - حمام | ḥammām | bathroom
  - سرير | sarīr | bed
  - كنبة | kanaba | sofa
  - ترابيزة | tarabēza | table
  - ده بتاعي | da bitāʿi | this is mine
- Cloze: "الكنبة دي ___" (بتاعتي / بتاعي / بتوعي).
- Conversation: describing your apartment to a new neighbour, saying which room is whose.

### eg-17 Colours and Descriptions (adjective agreement)
- Level: elementary. Topic: `colours`.
- Grammar: adjectives follow the noun and agree in gender (aḥmar / ḥamra); colour adjectives have a special feminine form. Non-human plurals take a feminine singular adjective. Why now: needed before comparatives and clothes.
- Vocabulary:
  - أحمر / حمرا | aḥmar / ḥamra | red
  - أزرق / زرقا | azraʾ / zarʾa | blue
  - أخضر / خضرا | akhḍar / khaḍra | green
  - أصفر / صفرا | aṣfar / ṣafra | yellow
  - أبيض / بيضا | abyaḍ / bēḍa | white
  - أسود / سودا | iswid / sōda | black
  - كبير / كبيرة | kibīr / kibīra | big
  - جديد / جديدة | gidīd / gidīda | new
- Cloze: "العربية ___" (حمرا / أحمر / حمر) with عربية feminine.
- Conversation: describing a lost bag to someone ("shanṭa zarʾa kibīra").

### eg-18 Clothes (dual and plural)
- Level: elementary. Topic: `clothes`.
- Grammar: dual with -ēn (gazmitēn); broken plurals (ʾamīṣ -> ʾumṣān); numbers 3-10 take plural. Why now: clothes come in pairs and sets, and shopping from eg-07 can now be done for items.
- Vocabulary:
  - قميص | ʾamīṣ | shirt (pl. ʾumṣān)
  - بنطلون | bantalōn | trousers
  - فستان | fustān | dress
  - جزمة | gazma | shoe (gazmitēn: a pair)
  - شراب | shurrāb | socks
  - جاكت | gākit | jacket
  - مقاس | maʾās | size
  - لبس | libs | clothes
- Cloze: "عايز ___ بنطلون" (اتنين / اتنين بنطلونات / اتنين) tests dual vs number+noun; second blank tests the plural.
- Conversation: buying a shirt and a pair of shoes, asking for a different size.

### eg-19 Weather and Seasons (comparatives)
- Level: elementary. Topic: `weather`.
- Grammar: comparative aʿfal pattern + min (aḥarr min, abrad min, aḥsan min). Why now: weather is the classic place to compare ("hotter than yesterday"), and agreement is now known.
- Vocabulary:
  - الجو | il-gaww | the weather
  - حر | ḥarr | heat, hot
  - برد | bard | cold
  - شمس | shams | sun
  - مطر | maṭar | rain
  - الصيف | iṣ-ṣēf | summer
  - الشتا | ish-shita | winter
  - أحر من | aḥarr min | hotter than
- Cloze: "الجو النهارده ___ من امبارح" (أحسن / حسن / الأحسن).
- Conversation: small talk about weather and favourite season ("il-gaww ḥarr awi").

### eg-20 Body and Health in Detail
- Level: elementary. Topic: `body-health`.
- Grammar: pain with object suffix: ḍahri biywagaʿni (my back hurts me), subject agrees with the body part; second grammar point: imperative advice (khud id-dawa). Why now: builds on ʿandi symptoms of eg-10 with the verb system now available.
- Vocabulary:
  - راسي بتوجعني | rāsi bitwagaʿni | my head hurts
  - ضهري بيوجعني | ḍahri biywagaʿni | my back hurts
  - ضرسي بيوجعني | ḍirsi biywagaʿni | my tooth hurts
  - حرارة | ḥarāra | fever
  - كحة | kuḥḥa | cough
  - دوا | dawa | medicine
  - روشتة | rushetta | prescription
  - خد الدوا | khud id-dawa | take the medicine
- Cloze: "بطني ___" (بتوجعني / بيوجعني / وجع) based on feminine بطن.
- Conversation: at the doctor, describing which part hurts and receiving advice.

### eg-21 Egyptian Dishes (object pronouns)
- Level: intermediate. Topic: `dishes`.
- Grammar: object suffixes on verbs (-u him/it, -ha her/it, -hum them): akaltu, baḥibbaha, garrabtaha. Why now: talk about dishes you tried, with tenses known.
- Vocabulary:
  - كشري | kushari | kushari
  - طعمية | ṭaʿmiyya | Egyptian falafel
  - ملوخية | mulūkhiyya | mulukhiyya (green soup/stew)
  - محشي | maḥshi | stuffed vegetables
  - فراخ | firākh | chicken
  - رز | ruzz | rice
  - شوربة | shurba | soup
  - جربتها؟ | garrabtaha? | have you tried it?
- Cloze: "الملوخية دي حلوة، أكلت___ امبارح" (ها / ه / هم).
- Conversation: ordering at a kushari shop and recommending dishes to a friend.

### eg-22 Phone and Internet (ʿāyiz / mumkin + subjunctive)
- Level: intermediate. Topic: `phone`.
- Grammar: ʿāyiz/ʿāyza and mumkin followed by a subjunctive verb (ʿāyiz akallimak, mumkin tibʿatli). Why now: first time a second verb follows a modal, necessary for any service request.
- Vocabulary:
  - موبايل | mobāyil | mobile phone
  - رقم | raʾam | number
  - رصيد | raṣīd | phone credit
  - شاحن | shāḥin | charger
  - واي فاي | wāy fāy | Wi-Fi
  - رسالة | risāla | message
  - كلمني | kallimni | call me
  - ابعتلي | ibʿatli | send me
- Cloze: "ممكن ___ رقمك؟" (آخد / باخد / خدت).
- Conversation: exchanging numbers and asking for the Wi-Fi password.

### eg-23 Asking for Repetition and Help
- Level: intermediate. Topic: `conversation-repair`.
- Grammar: question words and polite requests (yaʿni ēh, izzāy), ma-...-sh in past (masmiʿtish) and mumkin + subjunctive. Why now: lets the learner survive real conversations before storytelling.
- Vocabulary:
  - مش فاهم | mish fāhim | I don't understand
  - ممكن تعيد؟ | mumkin tiʿīd? | can you repeat?
  - على مهلك | ʿala mahlak | take it slow
  - يعني إيه؟ | yaʿni ēh? | what does it mean?
  - إزاي أقول...؟ | izzāy aʾūl...? | how do I say...?
  - ما سمعتش | masmiʿtish | I didn't hear
  - بتتكلم إنجليزي؟ | bititkallim ingilīzi? | do you speak English?
  - فهمت | fihimt | I understood
- Cloze: "ممكن ___ تاني؟" (تقول / بتقول / قلت).
- Conversation: a shopkeeper speaks too fast and you ask for repetition and for a word's meaning.

### eg-24 Invitations and Visits
- Level: intermediate. Topic: `visits`.
- Grammar: ʿashān (because / so that) and politeness formulas. Why now: hospitality is central to Egyptian culture; it adds reasons to existing sentence patterns.
- Vocabulary:
  - عزومة | ʿazūma | invitation (to a meal)
  - اتفضل | itfaḍḍal | please, come in / help yourself
  - ضيف | ḍēf | guest
  - هدية | hadiyya | gift
  - زيارة | ziyāra | visit
  - تشرب إيه؟ | tishrab ēh? | what will you drink?
  - ما تتعبش نفسك | matitʿibsh nafsak | don't trouble yourself
  - عشان | ʿashān | because, so that
- Cloze: "جيت ___ أزورك" (عشان / علشان ما / لأن).
- Conversation: arriving at a friend's family home with a gift and being offered tea.

### eg-25 Telling a Story in the Past
- Level: intermediate. Topic: `stories`.
- Grammar: kān + verb for past habit or scene, and sequencing with lamma, baʿdēn. Why now: the learner now has past, negation and connectors; this is the point to chain them.
- Vocabulary:
  - لما | lamma | when
  - فجأة | fagʾa | suddenly
  - بعدين | baʿdēn | then, later
  - قبل كده | ʾabl kida | before that
  - كنت | kunt | I was
  - كان فيه | kān fīh | there was
  - الأول | il-awwil | at first
  - في الآخر | fil-ākhir | in the end
- Cloze: "___ وصلت البيت، نمت" (لما / عشان / بعدين).
- Conversation: telling a friend about a day when you missed the metro.

### eg-26 Shopping and Bargaining in the Souq
- Level: intermediate. Topic: `souq`.
- Grammar: numbers 11-1000 (miyya wi khamsīn) with singular nouns after 11. Why now: souq bargaining needs bigger prices; eg-04 gave only 1-10 and 20.
- Vocabulary:
  - سوق | sūʾ | market
  - فصال | fiṣāl | bargaining
  - سعر | siʿr | price
  - غالي عليا | ghāli ʿalayya | too expensive for me
  - ينفع تنزل شوية؟ | yinfaʿ tinazzil shwayya? | can you lower it a little?
  - مية وخمسين | miyya wi khamsīn | 150
  - عشان خاطري | ʿashān khāṭri | please (for my sake)
  - هاخد اتنين | hākhud itnēn | I'll take two
- Cloze: "الإيشارب ده بـ ___ جنيه" (مية وخمسين / خمسين مية / مية خمسين).
- Conversation: haggling for a scarf at Khan el-Khalili.

### eg-27 Travel and Hotels
- Level: intermediate. Topic: `hotel`.
- Grammar: existence with fīh and mafīsh. Why now: asking whether something is available is the main hotel pattern, and it extends mish.
- Vocabulary:
  - فندق | funduʾ | hotel
  - حجزت أوضة | ḥagazt ōḍa | I booked a room
  - جواز السفر | gawāz is-safar | passport
  - مفتاح | miftāḥ | key
  - مطار | maṭār | airport
  - فيه أوضة فاضية؟ | fīh ōḍa fāḍya? | is there an empty room?
  - مفيش | mafīsh | there isn't
  - ليلة | lēla | night
- Cloze: "___ أوضة فاضية؟" (فيه / في / عندي).
- Conversation: checking into a hotel and asking for an extra night.

### eg-28 Opinions, Advice and Agreement
- Level: intermediate. Topic: `opinions`.
- Grammar: lāzim, il-mafrūḍ, yinfaʿ + subjunctive. Why now: SOAS and Kallimni both include likes, advice and disagreeing at this stage.
- Vocabulary:
  - لازم | lāzim | must
  - المفروض | il-mafrūḍ | should, supposed to
  - ينفع | yinfaʿ | it's possible/okay
  - رأيي | raʾyi | my opinion
  - موافق | muwāfiʾ | I agree (m.)
  - مش موافق | mish muwāfiʾ | I disagree
  - أنا شايف إن | ana shāyif inn | I think that
  - نصيحة | naṣīḥa | advice
- Cloze: "لازم ___ دلوقتي" (تروح / بتروح / رحت).
- Conversation: two friends disagree about which restaurant to choose.

### eg-29 Egypt: Sights and Holidays
- Level: intermediate. Topic: `egypt-culture`.
- Grammar: illi (who/which) relative clause and superlative (aḥla ḥāga). Why now: lets learners describe things in detail.
- Vocabulary:
  - الأهرامات | il-ahrāmāt | the pyramids
  - النيل | in-nīl | the Nile
  - المتحف | il-matḥaf | the museum
  - الأقصر وأسوان | il-uʾṣur wi aswān | Luxor and Aswan
  - رمضان | ramaḍān | Ramadan
  - العيد | il-ʿīd | the feast
  - اللي | illi | who, which, that
  - أحلى | aḥla | nicest
- Cloze: "ده المكان ___ شفته امبارح" (اللي / اللى هو / ده).
- Conversation: recommending places to a visiting friend.

### eg-30 Review: A Day in Cairo (mini-dialogue)
- Level: intermediate. Topic: `review-day`.
- Grammar: no new grammar; consolidates tense choice (b-, past, ha-), negation, imperatives and modals in one narrated day. Why now: the final recycle.
- Vocabulary (new discourse words):
  - إيه أخباركم؟ | ēh akhbārak? | what's new?
  - يلا بينا | yalla bīna | let's go
  - ماشي | māshi | OK
  - طيب | ṭayyib | well, OK
  - خلاص | khalāṣ | that's it, done
  - بالسلامة | bis-salāma | goodbye, take care
  - على فكرة | ʿala fikra | by the way
  - تمام | tamām | perfect, fine
- Cloze: "الأول رحت السوق، ___ ركبت الميكروباص" (بعدين / لأن / فيه).
- Conversation: a full day linking work, transport, a restaurant, a phone call, and an invitation.
