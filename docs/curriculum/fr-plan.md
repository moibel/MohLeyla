# French (fr) curriculum plan: lessons 11-30

Status: research and plan only. No lesson JSON written. Lessons fr-01..fr-10 are in `src/data/content/fr/part1.json`.

## Sources

Read in full (text extracted and read):

1. https://www.unipa.it/strutture/cla/.content/documenti/20260402-Syllabus-Francese-A1_B2.pdf - Palermo CLA syllabus. Gives per-level communicative goals, vocabulary themes and grammar notions. Puts futur proche, passé récent, passé composé (avoir) and vouloir/devoir/pouvoir + infinitive in A1; passé composé with être, imparfait, futur simple, imperative, conditionnel de politesse, COD/COI, "y" (place) in A2; subjonctif, conditionnel passé, plus-que-parfait, discours rapporté in B1.
2. https://bop.fipf.org/wp-content/uploads/2017/03/refa343342.pdf - Beacco et al., *Référentiel A2 pour le français*, chapter 5 (grammar). A2 = "first morphosyntactic foundation". Present of être, avoir, aller, vouloir, pouvoir, devoir, savoir, venir, dire, faire, comprendre, connaître, -er verbs; imperative (2nd persons first); passé composé; futur proche; conditional only as modal use (je voudrais, vous pourriez); imparfait and futur simple only "certain forms and values", for avoir/être/aller/faire; direct-object pronouns for all persons, indirect only recognised for me/te/nous/vous.
3. https://www.univ-amu.fr/system/files/media-ressource/SUL_R%C3%A9f%C3%A9rentiel%20des%20niveaux%20de%20langue%20A1%20%C3%A0%20B2.pdf - Aix-Marseille SUL referential. A1: present by verb bases, imperative, futur proche, passé récent, passé composé, questions, ne...pas, articles, adjectives, prepositions of place. A2: adds futur simple, imparfait, passé composé vs imparfait, comparatif/superlatif, temporal markers (depuis, pendant, il y a), inversion questions, many irregular verbs. B1: conditional, subjonctif, hypotheses, reported speech.
4. https://mdl.unige.ch/application/files/3717/6397/4781/Elements_de_grammaire_A1-A2_v2025.pdf - Geneva Maison des langues, "Éléments de grammaire A1-A2". Used as a grammar checklist: determiners, adjectives, comparatives, pronouns (COD/COI, en/y, relatives), prepositions, present/imperative/passé récent/passé composé/imparfait/futur proche/futur simple/conditional, time markers, question and negation forms, logical connectors. Also lists subjonctif and gérondif (it is broader than the other sources; see Decisions).
5. https://edit.hueber.de/shared/elka/Internet_Muster/Red6/9783190033713_Muster_1.pdf - Alter Ego+ 1 foreword (Hachette FLE). Book covers A1 and A2.1 in 120 h (10 dossiers incl. dossier 0), prepares for DELF A1.
6. https://edit.hueber.de/shared/elka/Internet_Muster/Red6/9783190033706_Muster_2.pdf - Alter Ego+ 2 foreword. Starts at A2.1, aims at A2.2 and B1.1 (8 dossiers; dossiers 1-4 = A2.2; dossier 5 is the transition to B1.1), prepares for DELF A2.

Consulted only through search-result summaries (page itself not readable):
- France Éducation international DELF A2 pages (https://www.france-education-international.fr/diplome/delf-tout-public/niveau-a2 and the CECRL page): the site returned an anti-bot "ERR-BOT-403" page to the fetcher, so only the search snippet was used. It says DELF A2 = 4 papers (listening, reading, writing, speaking), speaking 6-8 min with guided interview, monologue and role play, and the goal is "simple everyday tasks" (shopping, asking information, public transport). No sample papers were read.
- Alliance Française Brussels-Europe and Paris course-structure pages (search snippets): A1 = 90 h, A2 = 120 h, B1 split in four modules. No grammar outline found; AF syllabi are centre- and textbook-specific.

Not found / not read: Cosmopolite and Édito tables of contents (only Alter Ego+ forewords were accessible; the unit-by-unit contents pages were not extractable). The topic order below is therefore based on the four syllabi/referentials plus general FLE practice, not on a verified coursebook table of contents.

## Decisions

**Level mapping.**
- Lessons 1-10 are phrase-based survival French (A1 first half; almost no conjugation taught yet).
- **11-20 (`elementary`) = rest of A1 into early A2.1.** Present tense system, futur proche, articles/partitive, adjectives, prepositions, modals, questions/negation. Nothing in 11-20 needs a past tense.
- **21-30 (`intermediate`) = A2.1 into A2.2, with 29-30 touching the B1 threshold** (connected writing, opinions, one `si` hypothesis). Honest limit: 20 short lessons cannot deliver a full A2 (Alter Ego+ needs about 240 h for A1-A2). By lesson 30 a learner reaches solid A2.1 and a partial A2.2, not DELF A2 readiness. The app copy should not promise B1.

**Progression logic.** Each lesson takes one situation (topic) and one grammar point, and re-uses the previous lessons' grammar in its dialogue. Order: things you can do (go, routine, hobbies) → things around you (food, clothes, home, city) → social function (phone, weather, questions) → past (passé composé avoir, être, imparfait) → advice/work → comparison and pronouns → future and travel → writing → review.

**Where the sources disagree, and what I chose.**
1. *Passé composé.* Palermo, AMU and Alter Ego+ 1 treat it as A1/A2.1; Beacco A2 wants it as a core A2 form. I put it at 21-22 (start of `intermediate`), after the present tense system is solid, because the app's learner is an adult beginner from Arabic/Indonesian backgrounds and the être/avoir split plus participle agreement is a big step. Controversial: a purely A1-oriented reading would move it into 18-20.
2. *Imparfait and futur simple.* Beacco says "initiation only" (avoir, être, aller, faire); Palermo and AMU put both at A2; Geneva teaches all verbs. I teach the full regular formation but ask only for recognition plus a few high-frequency verbs in the exercises. Futur simple is placed late (28) because futur proche covers most A2 needs.
3. *Object pronouns and en/y.* Beacco A2 asks for direct pronouns, but indirect pronouns only to be recognised, and en/y are not clearly listed; Palermo has only "y = place" at A2; AMU treats the pronoun system as consolidating at B1. Geneva puts it in A1-A2. I place it at 27, with direct me/te/nous/vous, le/la/les, lui/leur, y, en in the present, with futur proche and infinitive only (no passé composé agreement, no double pronouns).
4. *Subjonctif.* Excluded. Palermo and AMU assign it to B1; only Geneva lists it earlier.
5. *Conditionnel.* Only politeness/modal forms (je voudrais, tu pourrais, on pourrait) at 18, and one `si + imparfait → conditionnel` set phrase at 30 as a B1 teaser.
6. *Reflexive verbs.* L9 introduced `se lever`. Present-tense reflexives are in 12; reflexive passé composé is in 22.
7. *Weather, colours, house.* Palermo and AMU put these at A1; they are placed in 15, 16, 19 because they carry grammar (adjectives, prepositions, impersonal il).
8. The lessons use "tu" in dialogues between friends and "vous" for service situations, consistent with L2.

**Pronunciation scheme (same as part1.json).** Hyphen-separated syllables, stressed (last pronounced) syllable in capitals; `(n)` after a nasal vowel (`ah(n)`, `o(n)`, `eh(n)`, `uh(n)`); `zh` = j/g soft; `sh` = ch; `ew` = u; `uh` = eu/e muet; `ay` = é/er/ez; `eh` = è/ê/ai; `oh` = o/au/eau; `wah` = oi; `ny` = gn. Words linked by liaison are written with the extra consonant joined to the next word (`noo zah-vo(n)`).

**Recycling rule.** Every lesson's dialogue must use at least three items from earlier lessons (listed under "Recycles"). Lessons 1-10 items (greetings, je voudrais, prices, directions, time, mal à, je ne comprends pas) are never re-taught, only re-used.

## Overview table

| id | EN title | level | topic slug | grammar |
|---|---|---|---|---|
| fr-11 | Weekend Plans | elementary | weekend-plans | aller + futur proche, à + article |
| fr-12 | Daily Routine and Habits | elementary | daily-routine-habits | -er verbs and reflexive verbs |
| fr-13 | Hobbies and Sports | elementary | hobbies-sports | jouer à/de, faire du/de la, aimer + infinitive |
| fr-14 | Meals and Quantities | elementary | restaurant-meals | partitive, pas de, quantities |
| fr-15 | Clothes and Colours | elementary | clothes-colours | adjective agreement and position, ce/cet/cette |
| fr-16 | My Home | elementary | home-rooms | prepositions of place, il y a |
| fr-17 | City and Transport | elementary | city-transport | -ir and -re verbs, prendre family |
| fr-18 | Phone Calls and Invitations | elementary | phone-invitations | vouloir/pouvoir/devoir/savoir/venir, polite conditional |
| fr-19 | Weather, Seasons and Dates | elementary | weather-seasons | impersonal il, months, dates |
| fr-20 | Questions and Negation | elementary | questions-negation | 3 question forms, ne...jamais/plus/rien/personne |
| fr-21 | What I Did Yesterday | intermediate | past-avoir | passé composé with avoir |
| fr-22 | A Day Trip | intermediate | past-etre-trip | passé composé with être, reflexives |
| fr-23 | When I Was Young | intermediate | childhood-memories | imparfait; passé composé vs imparfait |
| fr-24 | At the Doctor and Pharmacy | intermediate | health-advice | imperative, il faut, devoir |
| fr-25 | Work and Studies | intermediate | work-studies | professions, depuis/pendant/il y a |
| fr-26 | Comparing and Choosing | intermediate | comparing-choices | comparatives and superlatives |
| fr-27 | Favours and Gifts | intermediate | favours-gifts | COD/COI pronouns, y, en |
| fr-28 | Travel and Hotel | intermediate | travel-hotel | futur simple |
| fr-29 | Writing a Short Message | intermediate | writing-messages | connectors, message formulas, si + présent + futur |
| fr-30 | Review: A Trip to France | intermediate | review-final | tense map and mixed review |

## Lessons

### fr-11 · Weekend Plans · elementary · `weekend-plans`
- **Grammar:** Present of aller (je vais, tu vas, il va, nous allons, vous allez, ils vont) and the futur proche `aller + infinitive`; `à + le = au`, `à + les = aux`, `en/au` + country. Why here: L2/L9 used "tu vas", "je vais au cinéma" as chunks; aller is the first verb every referential requires, and futur proche is the easiest way to talk about the future without learning a new tense.
- **Recycles:** days (L9), time (L9), où est (L8), je voudrais (L6).
- **Target words:**
  1. Qu'est-ce que tu vas faire ce week-end ? - `kehs-kuh tew vah FEHR suh wee-KEHND` - What are you going to do this weekend?
  2. Je vais voyager. - `zhuh vay vwah-yah-ZHAY` - I am going to travel.
  3. Nous allons au marché. - `noo zah-LO(n) oh mahr-SHAY` - We are going to the market.
  4. demain - `duh-MEH(n)` - tomorrow
  5. la semaine prochaine - `lah suh-MEHN proh-SHEHN` - next week
  6. Je vais en France. - `zhuh vay ah(n) FRAH(n)S` - I am going to France.
  7. Ils vont à la plage. - `eel vo(n) tah lah PLAHZH` - They are going to the beach.
  8. Je vais rester à la maison. - `zhuh vay rehs-TAY ah lah may-ZO(n)` - I am going to stay at home.
- **Cloze idea:** `Nous ___ au marché samedi.` answer *allons*, distractors *allez*, *vont*.
- **Conversation:** Monday at work, two colleagues compare their weekend plans (friend A is going to the beach, B stays home).

### fr-12 · Daily Routine and Habits · elementary · `daily-routine-habits`
- **Grammar:** Regular -er present endings (-e, -es, -e, -ons, -ez, -ent) plus reflexive verbs (me, te, se, nous, vous, se before the verb), and the negation round them (`je ne me lève pas`). Why: L9 gave `se lever`; this makes the pattern general, and the -er group is the largest class (Beacco, AMU).
- **Recycles:** time and days (L9), je mange à midi (L9), ne...pas (L10).
- **Target words:**
  1. Je me réveille à six heures. - `zhuh muh ray-VEHY ah see-ZUHR` - I wake up at six.
  2. Je prends une douche. - `zhuh prah(n) ewn DOOSH` - I take a shower.
  3. Je m'habille. - `zhuh mah-BEEY` - I get dressed.
  4. Je me brosse les dents. - `zhuh muh BROHS lay DAH(n)` - I brush my teeth.
  5. Je me couche tard. - `zhuh muh KOOSH TAHR` - I go to bed late.
  6. d'habitude - `dah-bee-TEWD` - usually
  7. souvent - `soo-VAH(n)` - often
  8. tous les jours - `too lay ZHOOR` - every day
- **Cloze idea:** `Je ne ___ pas tôt le dimanche.` answer *me lève*, distractors *lève*, *me levez*.
- **Conversation:** A host family asks a guest about a typical weekday; the guest describes mornings and evenings.

### fr-13 · Hobbies and Sports · elementary · `hobbies-sports`
- **Grammar:** `jouer à + sport`, `jouer de + instrument`, `faire du/de la/de l'/des + activity`, and `aimer / adorer / détester + infinitive`. Why: leisure is a core A1-A2 topic in every syllabus, and it teaches the contracted forms du/de la, which are needed again for the partitive in L14.
- **Recycles:** aller + infinitive (L11), time words (L9), je ne comprends pas (L10).
- **Target words:**
  1. Qu'est-ce que tu aimes faire ? - `kehs-kuh tew ehm FEHR` - What do you like to do?
  2. J'aime lire. - `zhehm LEER` - I like reading.
  3. Je fais du sport. - `zhuh feh dew SPOHR` - I do sport.
  4. Je joue au football. - `zhuh zhoo oh foot-BOHL` - I play football.
  5. Je joue de la guitare. - `zhuh zhoo duh lah gee-TAHR` - I play the guitar.
  6. Je fais de la natation. - `zhuh feh duh lah nah-tah-SYO(n)` - I swim (do swimming).
  7. J'adore la musique. - `zhah-DOHR lah mew-ZEEK` - I love music.
  8. Je déteste courir. - `zhuh day-TEHST koo-REER` - I hate running.
- **Cloze idea:** `Je joue ___ piano.` answer *du*, distractors *au*, *de la*.
- **Conversation:** Two new colleagues chat about free time and discover a shared hobby; B invites A to try it next week (futur proche).

### fr-14 · Meals and Quantities · elementary · `restaurant-meals`
- **Grammar:** Partitive du/de la/de l'/des for unspecified amounts, `le/la/les` for liking, and `de` (no article) after a negation or a quantity (`pas de viande`, `beaucoup de pain`). Why: L6 only showed `de l'eau`; the "pas de" rule is one of the most frequent A1-A2 errors in Beacco and Geneva.
- **Recycles:** je voudrais, l'addition, c'est délicieux (L6); ne...pas (L10); aimer + infinitive (L13).
- **Target words:**
  1. la carte - `lah KAHRT` - the menu
  2. l'entrée - `lah(n)-TRAY` - the starter
  3. le plat du jour - `luh plah dew ZHOOR` - today's special
  4. Je prends du poisson. - `zhuh prah(n) dew pwah-SO(n)` - I'll have some fish.
  5. Je ne mange pas de viande. - `zhuh nuh mah(n)zh PAH duh vyah(n)d` - I don't eat meat.
  6. Je suis végétarien. / végétarienne. - `zhuh swee vay-zhay-tah-RYEH(n)` / `...ryehn` - I am vegetarian (m/f).
  7. un verre d'eau - `uh(n) vehr DOH` - a glass of water
  8. Bon appétit ! - `bo(n)-nah-pay-TEE` - Enjoy your meal!
- **Cloze idea:** `Je ne mange pas ___ viande.` answer *de*, distractors *de la*, *la*.
- **Conversation:** At a restaurant, a vegetarian friend and a meat-eater order a starter, main and drink; the waiter asks what they want.

### fr-15 · Clothes and Colours · elementary · `clothes-colours`
- **Grammar:** Adjective agreement (add -e for feminine, -s for plural; irregular blanc/blanche, vert/verte) and position (most adjectives after the noun; petit, grand, beau, bon before it), plus demonstratives ce/cet/cette/ces. Why: AMU/Palermo make agreement and place of adjectives an A1 point; colours and clothes are the best natural practice.
- **Recycles:** je cherche, c'est cher, je le prends, combien ça coûte (L7); mon/ma (L5).
- **Target words:**
  1. une robe rouge - `ewn rohb ROOZH` - a red dress
  2. un pantalon noir - `uh(n) pah(n)-tah-LO(n) NWAHR` - black trousers
  3. une chemise blanche - `ewn shuh-MEEZ BLAH(n)SH` - a white shirt
  4. des chaussures vertes - `day shoh-SEWR VEHRT` - green shoes
  5. un petit sac bleu - `uh(n) puh-TEE sahk BLUH` - a small blue bag
  6. Cette veste est jolie. - `seht VEHST eh zhoh-LEE` - This jacket is pretty.
  7. Je peux essayer ? - `zhuh puh eh-seh-YAY` - Can I try it on?
  8. Quelle taille ? - `kehl TAHY` - What size?
- **Cloze idea:** `Elle porte une robe ___.` answer *verte*, distractors *vert*, *verts*.
- **Conversation:** A shop assistant helps a customer find a jacket in the right size and colour; the customer tries it on and decides.

### fr-16 · My Home · elementary · `home-rooms`
- **Grammar:** Prepositions of place (dans, sur, sous, devant, derrière, à côté de, entre) and `il y a / il n'y a pas de`; `de + le = du`. Why: every referential lists prepositions of place at A1, and `il y a` (not taught before) is needed for description.
- **Recycles:** où est (L8), à gauche/à droite (L8), adjectives (L15), pas de (L14).
- **Target words:**
  1. J'habite dans un appartement. - `zhah-BEET dah(n) zuh(n) nah-pahr-tuh-MAH(n)` - I live in an apartment.
  2. la cuisine - `lah kwee-ZEEN` - the kitchen
  3. la chambre - `lah SHAH(n)-bruh` - the bedroom
  4. Il y a un canapé dans le salon. - `eel ee ah uh(n) kah-nah-PAY dah(n) luh sah-LO(n)` - There is a sofa in the living room.
  5. sur la table - `sewr lah TAH-bluh` - on the table
  6. à côté de la fenêtre - `ah koh-TAY duh lah fuh-NEH-truh` - next to the window
  7. derrière la porte - `dehr-YEHR lah PORT` - behind the door
  8. Il n'y a pas de lit. - `eel nee ah pah duh LEE` - There is no bed.
- **Cloze idea:** `Le livre est ___ la table.` (picture/English cue "on") answer *sur*, distractors *sous*, *dans*.
- **Conversation:** A visitor tours a rented flat; the landlord describes each room and the visitor asks where things are.

### fr-17 · City and Transport · elementary · `city-transport`
- **Grammar:** Present of regular -ir (finir, choisir) and -re (attendre, descendre) verbs, partir, and the whole prendre family (prends, prenons, prennent; comprendre). Why: Beacco and AMU require the present of the main verb groups by "bases"; prendre was only used as "je prends" in L7, and transport is the natural context.
- **Recycles:** où est la gare, tout droit, tournez (L8); time (L9); aller (L11).
- **Target words:**
  1. Je prends le métro. - `zhuh prah(n) luh may-TROH` - I take the metro.
  2. Le bus part à huit heures. - `luh bews PAHR ah wee-TUHR` - The bus leaves at eight.
  3. Nous attendons le tram. - `noo zah-tah(n)-DO(n) luh TRAHM` - We are waiting for the tram.
  4. Vous descendez à la prochaine station. - `voo day-sah(n)-DAY ah lah proh-SHEHN stah-SYO(n)` - You get off at the next stop.
  5. un billet - `uh(n) bee-YEH` - a ticket
  6. Je finis à six heures. - `zhuh fee-NEE ah see-ZUHR` - I finish at six.
  7. à pied - `ah PYAY` - on foot
  8. en voiture - `ah(n) vwah-TEWR` - by car
- **Cloze idea:** `Ils ___ le tram.` answer *attendent*, distractors *attend*, *attendons*.
- **Conversation:** At a station, a traveller buys a ticket and asks which line and which stop to get off.

### fr-18 · Phone Calls and Invitations · elementary · `phone-invitations`
- **Grammar:** vouloir, pouvoir, devoir (and savoir, venir) in the present followed by an infinitive; polite conditional chunks `je voudrais`, `tu pourrais`, `on pourrait`. Why: these verbs are the most useful in A2 communication (all sources), and Beacco explicitly lists conditional only in these modal uses.
- **Recycles:** je voudrais (L6), pouvez-vous (L10), time (L9), aller + infinitive (L11), hobbies (L13).
- **Target words:**
  1. Allô ? C'est Sara. - `ah-LOH seh sah-RAH` - Hello? It's Sara. (phone)
  2. Tu veux venir au cinéma ? - `tew vuh vuh-NEER oh see-nay-MAH` - Do you want to come to the cinema?
  3. Oui, avec plaisir ! - `wee ah-VEHK pleh-ZEER` - Yes, with pleasure!
  4. Désolé, je ne peux pas. - `day-zoh-LAY zhuh nuh puh PAH` - Sorry, I can't.
  5. Je dois travailler. - `zhuh dwah trah-vah-YAY` - I have to work.
  6. Tu peux me rappeler ? - `tew puh muh rah-puh-LAY` - Can you call me back?
  7. À quelle heure ? - `ah kehl UHR` - At what time?
  8. Je ne sais pas. - `zhuh nuh say PAH` - I don't know.
- **Cloze idea:** `Désolé, je ne ___ pas venir.` answer *peux*, distractors *peut*, *pouvez*.
- **Conversation:** A phone call inviting a friend to a birthday dinner; the friend declines politely with a reason and suggests another day.

### fr-19 · Weather, Seasons and Dates · elementary · `weather-seasons`
- **Grammar:** The impersonal `il` for weather (il fait + adjective, il pleut, il neige), `au printemps / en été / en automne / en hiver`, months and dates (`le cinq mai`). Why: weather is A1 in Palermo and AMU; the impersonal `il` and the season prepositions are classic first-year traps.
- **Recycles:** days (L9), futur proche (L11), hobbies and sports (L13), clothes (L15).
- **Target words:**
  1. Quel temps fait-il ? - `kehl tah(n) feh-TEEL` - What is the weather like?
  2. Il fait beau. - `eel feh BOH` - The weather is nice.
  3. Il pleut. - `eel PLUH` - It is raining.
  4. Il neige. - `eel NEHZH` - It is snowing.
  5. Il fait chaud. / Il fait froid. - `eel feh SHOH` / `eel feh FRWAH` - It is hot. / It is cold.
  6. au printemps - `oh preh(n)-TAH(n)` - in spring
  7. en hiver - `ah(n) nee-VEHR` - in winter
  8. Nous sommes le cinq mai. - `noo som luh seh(n)k MEH` - It is the fifth of May.
- **Cloze idea:** `Aujourd'hui, il ___ beau.` answer *fait*, distractors *est*, *a*.
- **Conversation:** Two friends plan an outing from the forecast ("Demain, il va pleuvoir") and decide what to wear and do.

### fr-20 · Questions and Negation · elementary · `questions-negation`
- **Grammar:** Three question forms (intonation, `est-ce que`, simple inversion `Quand partez-vous ?`), the question words (où, quand, comment, pourquoi, combien), and `ne...jamais / plus / rien / personne`. Why: AMU/Beacco expect all three registers at A2, and L10 only introduced `ne...pas`.
- **Recycles:** comment, où, quel âge, combien (L2-L8), ne...pas (L10), pouvoir (L18).
- **Target words:**
  1. Est-ce que vous parlez anglais ? - `ehs-kuh voo pahr-LAY ah(n)-GLEH` - Do you speak English?
  2. Pourquoi ? / Parce que... - `poor-KWAH` / `pahrs-kuh` - Why? / Because...
  3. Quand partez-vous ? - `kah(n) pahr-tay-VOO` - When are you leaving?
  4. Combien de temps ? - `ko(n)-BYEH(n) duh TAH(n)` - How long?
  5. Je ne fume jamais. - `zhuh nuh FEWM zhah-MEH` - I never smoke.
  6. Je n'ai plus faim. - `zhuh nay plew FEH(n)` - I'm not hungry any more.
  7. Il n'y a rien. - `eel nee ah RYEH(n)` - There is nothing.
  8. Personne n'est là. - `pehr-SOHN neh LAH` - Nobody is there.
- **Cloze idea:** `Je ne mange ___ de viande.` answer *jamais*, distractors *rien*, *personne*.
- **Conversation:** At a tourist office, a visitor asks when a guided tour starts, how long it lasts and whether it is free; the clerk answers with a negative.

### fr-21 · What I Did Yesterday · intermediate · `past-avoir`
- **Grammar:** Passé composé with avoir (present of avoir + participle -é/-i/-u) and the frequent irregular participles (fait, pris, eu, vu, bu, dit); negation wraps avoir (`je n'ai pas dormi`); time markers hier, ce matin, la semaine dernière, il y a deux jours. Why: first past tense in all syllabi; avoir is the easier auxiliary, so it comes before être.
- **Recycles:** avoir (L4), prendre (L7/L17), -er verbs (L12), ne...pas (L10), questions (L20).
- **Target words:**
  1. Hier, j'ai travaillé. - `yehr zhay trah-vah-YAY` - Yesterday I worked.
  2. Qu'est-ce que tu as fait ? - `kehs-kuh tew ah FEH` - What did you do?
  3. J'ai mangé au restaurant. - `zhay mah(n)-ZHAY oh rehs-toh-RAH(n)` - I ate at a restaurant.
  4. Nous avons vu un film. - `noo zah-vo(n) vew uh(n) FEELM` - We saw a film.
  5. Je n'ai pas dormi. - `zhuh nay pah dohr-MEE` - I did not sleep.
  6. J'ai pris le train. - `zhay pree luh TREH(n)` - I took the train.
  7. la semaine dernière - `lah suh-MEHN dehr-NYEHR` - last week
  8. il y a deux jours - `eel ee ah duh ZHOOR` - two days ago
- **Cloze idea:** `Hier, nous avons ___ un film.` answer *vu*, distractors *voir*, *vois*.
- **Conversation:** On Monday morning two friends tell each other what they did at the weekend.

### fr-22 · A Day Trip · intermediate · `past-etre-trip`
- **Grammar:** Passé composé with être (aller, venir, arriver, partir, rester, rentrer, sortir, naître) and all reflexive verbs; the participle agrees with the subject (`elle est partie`). Why: Beacco and AMU name the être auxiliary and its agreement as the A2 core of the passé composé; L12 reflexives are re-used.
- **Recycles:** aller (L11), transport (L17), reflexives (L12), passé composé avoir (L21), time markers (L21).
- **Target words:**
  1. Je suis allé à Lyon. - `zhuh swee zah-LAY ah lee-O(n)` - I went to Lyon.
  2. Elle est partie hier. - `ehl eh pahr-TEE yehr` - She left yesterday.
  3. Nous sommes arrivés à midi. - `noo sohm zah-ree-VAY ah mee-DEE` - We arrived at noon.
  4. Ils sont restés deux jours. - `eel so(n) rehs-TAY duh ZHOOR` - They stayed two days.
  5. Je suis rentrée tard. - `zhuh swee rah(n)-TRAY TAHR` - I got home late. (female speaker)
  6. Je me suis levé tôt. - `zhuh muh swee luh-VAY TOH` - I got up early.
  7. Tu es venu seul ? - `tew eh vuh-NEW SUHL` - Did you come alone?
  8. Je ne suis pas sorti. - `zhuh nuh swee pah sohr-TEE` - I did not go out.
- **Cloze idea:** `Marie est ___ à Paris.` answer *allée*, distractors *allé*, *aller*.
- **Conversation:** A traveller tells a friend about a day trip: when they left, how they went, where they ate, when they came back.

### fr-23 · When I Was Young · intermediate · `childhood-memories`
- **Grammar:** The imparfait (stem of nous-form + -ais, -ais, -ait, -ions, -iez, -aient; être = ét-) for habits and descriptions in the past, with a first contrast to the passé composé (`Il pleuvait quand je suis sorti`). Why: A2 in Palermo/AMU; Beacco asks only recognition and avoir/être/aller/faire, so exercises focus on those and on reading.
- **Recycles:** je suis/j'ai (L3-L4), family (L5), weather (L19), passé composé (L21-22), hobbies (L13).
- **Target words:**
  1. Quand j'étais petit... - `kah(n) zhay-TEH puh-TEE` - When I was little...
  2. J'habitais à la campagne. - `zhah-bee-TEH ah lah kah(n)-PAH-nyuh` - I used to live in the countryside.
  3. Nous jouions dans le jardin. - `noo zhoo-YO(n) dah(n) luh zhahr-DEH(n)` - We used to play in the garden.
  4. Il faisait beau. - `eel fuh-ZEH BOH` - The weather was nice.
  5. Elle avait les cheveux longs. - `ehl ah-VEH lay shuh-VUH LO(n)` - She had long hair.
  6. Avant, je ne travaillais pas. - `ah-VAH(n) zhuh nuh trah-vah-YEH PAH` - Before, I did not work.
  7. Il pleuvait quand je suis sorti. - `eel pluh-VEH kah(n) zhuh swee sohr-TEE` - It was raining when I went out.
  8. autrefois - `oh-truh-FWAH` - in the past
- **Cloze idea:** `Quand j'___ petit, je jouais dehors.` answer *étais*, distractors *ai été*, *suis*.
- **Conversation:** A grandparent tells a grandchild what life, school and holidays were like long ago.

### fr-24 · At the Doctor and Pharmacy · intermediate · `health-advice`
- **Grammar:** The imperative (tu/vous/nous: `Prenez`, `Buvez`, `Repose-toi`, negative `ne fumez pas`), `il faut + infinitive` and `devoir`. Why: giving instructions and advice is an A2 function in all the sources; this extends the L10 emergency language to a real consultation.
- **Recycles:** j'ai mal à (L10), j'ai besoin de (L10), reflexives (L12), pouvoir/devoir (L18), négation (L20), days/times (L9).
- **Target words:**
  1. J'ai de la fièvre. - `zhay duh lah FYEH-vruh` - I have a fever.
  2. Je tousse. - `zhuh TOOS` - I am coughing.
  3. Depuis quand avez-vous mal ? - `duh-PWEE kah(n) ah-vay-VOO MAHL` - Since when have you been in pain?
  4. Prenez ce médicament deux fois par jour. - `pruh-NAY suh may-dee-kah-MAH(n) duh FWAH pahr ZHOOR` - Take this medicine twice a day.
  5. Il faut se reposer. - `eel foh suh ruh-poh-ZAY` - You need to rest.
  6. Buvez beaucoup d'eau. - `bew-VAY boh-KOO DOH` - Drink lots of water.
  7. une ordonnance - `ewn ohr-doh-NAH(n)S` - a prescription
  8. Ça va mieux. - `sah vah MYUH` - I feel better.
- **Cloze idea:** `___ ce sirop trois fois par jour.` answer *Prenez*, distractors *Prends*, *Prendre*.
- **Conversation:** At a doctor's office, then the pharmacy: symptoms, advice, a prescription, how to take the medicine.

### fr-25 · Work and Studies · intermediate · `work-studies`
- **Grammar:** Professions without an article (`je suis étudiant`) vs `c'est un étudiant`; duration with `depuis` (+ present), `pendant` (+ duration), `il y a` (+ past). Why: AMU lists these three markers together at A2; work and study are A2 vocabulary themes in every source. Depuis was previewed as a chunk in L24.
- **Recycles:** je suis/j'habite (L3), mon/ma (L5), numbers (L4), passé composé (L21), questions (L20).
- **Target words:**
  1. Je suis étudiant en droit. - `zhuh swee zay-tew-DYAH(n) ah(n) DRWAH` - I am a law student.
  2. Je travaille dans une banque. - `zhuh trah-VAHY dah(n) zewn BAH(n)K` - I work in a bank.
  3. Je cherche du travail. - `zhuh SHEHRSH dew trah-VAHY` - I am looking for work.
  4. Il est infirmier. - `eel eh teh(n)-feer-MYAY` - He is a nurse.
  5. Je travaille ici depuis deux ans. - `zhuh trah-VAHY ee-SEE duh-PWEE duh ZAH(n)` - I have worked here for two years.
  6. J'ai étudié pendant trois ans. - `zhay ay-tew-DYAY pah(n)-DAH(n) trwah ZAH(n)` - I studied for three years.
  7. un entretien d'embauche - `uh(n) nah(n)-truh-TYEH(n) dah(n)-BOHSH` - a job interview
  8. mon patron / ma collègue - `mo(n) pah-TRO(n)` / `mah koh-LEHG` - my boss / my colleague (f)
- **Cloze idea:** `Elle est ___ depuis un an.` answer *médecin*, distractors *un médecin*, *le médecin*.
- **Conversation:** A short job interview: current job, studies, how long, why this company.

### fr-26 · Comparing and Choosing · intermediate · `comparing-choices`
- **Grammar:** Comparatives (`plus / moins / aussi + adjective + que`, `plus de / autant de + noun`), superlatives (`le/la/les plus`), irregular `meilleur / mieux`. Why: Beacco and AMU place the comparative/superlative at A2; the lesson builds on adjectives (L15) and city/home vocabulary.
- **Recycles:** adjectives (L15), prices (L7), home (L16), city (L17), weather (L19).
- **Target words:**
  1. plus grand que - `plew GRAH(n) kuh` - bigger than
  2. moins cher que - `mwah(n) SHEHR kuh` - cheaper than
  3. aussi bon que - `oh-SEE bo(n) kuh` - as good as
  4. C'est le plus beau. - `seh luh plew BOH` - It is the most beautiful.
  5. C'est la meilleure solution. - `seh lah meh-YUHR soh-lew-SYO(n)` - It is the best solution.
  6. Je cours plus vite que toi. - `zhuh KOOR plew VEET kuh TWAH` - I run faster than you.
  7. Il y a moins de bruit. - `eel ee ah mwah(n) duh BRWEE` - There is less noise.
  8. Lequel est le moins cher ? - `luh-KEHL eh luh mwah(n) SHEHR` - Which one is the cheapest?
- **Cloze idea:** `Cet appartement est ___ grand que l'autre.` answer *plus*, distractors *très*, *plus de*.
- **Conversation:** Two people compare two flats (or two phone plans) on price, size and noise, then choose one.

### fr-27 · Favours and Gifts · intermediate · `favours-gifts`
- **Grammar:** Object pronouns in the present: direct `me, te, le/la/l', nous, vous, les`; indirect `lui, leur` (plus me/te/nous/vous); `y` (place) and `en` (quantity), placed before the verb (`je le vois`, `je vais l'acheter`). Why: avoids repeating nouns in connected speech (A2 function); kept to present/futur proche (no passé composé agreement or double pronouns, which are B1).
- **Recycles:** je le prends (L7), négation (L20), aller + infinitive (L11), partitive (L14), pouvoir (L18).
- **Target words:**
  1. Tu connais Paul ? Oui, je le connais. - `tew koh-NEH pohl` / `wee zhuh luh koh-NEH` - Do you know Paul? Yes, I know him.
  2. Je lui téléphone. - `zhuh lwee tay-lay-FOHN` - I phone him/her.
  3. Je leur donne un cadeau. - `zhuh luhr DOHN uh(n) kah-DOH` - I give them a gift.
  4. Tu m'aides ? - `tew MEHD` - Will you help me?
  5. Tu vas au marché ? Oui, j'y vais. - `wee zhee VEH` - Are you going to the market? Yes, I'm going (there).
  6. Tu veux du café ? J'en veux, merci. - `zhah(n) VUH` - Do you want some coffee? I'd like some.
  7. Je ne les vois pas. - `zhuh nuh lay VWAH PAH` - I do not see them.
  8. Je vais l'acheter. - `zhuh vay lah-shuh-TAY` - I am going to buy it.
- **Cloze idea:** `Je ___ téléphone demain (à ma sœur).` answer *lui*, distractors *la*, *leur*.
- **Conversation:** Two friends prepare a party: who is invited, who buys the cake, who brings the drinks; everything answered with pronouns.

### fr-28 · Travel and Hotel · intermediate · `travel-hotel`
- **Grammar:** Futur simple (infinitive + -ai, -as, -a, -ons, -ez, -ont) and the common irregular stems (être = ser-, avoir = aur-, aller = ir-, faire = fer-, venir = viendr-). Why: A2 in Palermo/AMU; Beacco notes the link between the endings of avoir/aller and the future endings. It is placed late because futur proche already covers most needs; the future is used here for bookings and promises.
- **Recycles:** je voudrais (L6), time (L9), transport (L17), phone (L18), futur proche (L11), numbers (L4).
- **Target words:**
  1. Je voudrais réserver une chambre double. - `zhuh voo-DREH ray-zehr-VAY ewn SHAH(n)-bruh DOO-bluh` - I would like to book a double room.
  2. Pour combien de nuits ? - `poor ko(n)-BYEH(n) duh NWEE` - For how many nights?
  3. Le petit déjeuner est compris. - `luh puh-TEE day-zhuh-NAY eh ko(n)-PREE` - Breakfast is included.
  4. Nous arriverons vers six heures. - `noo zah-ree-vuh-RO(n) vehr see-ZUHR` - We will arrive around six.
  5. Je serai là demain. - `zhuh suh-RAY lah duh-MEH(n)` - I will be there tomorrow.
  6. un billet d'avion - `uh(n) bee-YEH dah-VYO(n)` - a plane ticket
  7. Le passeport, s'il vous plaît. - `luh pahs-POHR` - The passport, please.
  8. Je visiterai le musée. - `zhuh vee-zee-tuh-RAY luh mew-ZAY` - I will visit the museum.
- **Cloze idea:** `Demain, nous ___ à l'hôtel à six heures.` answer *arriverons*, distractors *arrivons*, *arrivez*.
- **Conversation:** Booking a hotel by phone and then checking in: dates, room, breakfast, arrival time, passport.

### fr-29 · Writing a Short Message · intermediate · `writing-messages`
- **Grammar:** Linking a message with connectors (`parce que, mais, donc, ensuite, pour + infinitive`), the opening/closing formulas of a friendly message, and the B1-threshold structure `si + présent + futur`. Why: DELF A2 writing asks for two short messages of at least 60 words each (search summary of the FEI page); AMU and Palermo list "écrire une lettre personnelle simple" at A2.
- **Recycles:** past (L21-23), future (L11, L28), invitation (L18), pronouns (L27), weather and places (L16-L19).
- **Target words:**
  1. Cher Paul, / Chère Marie, - `SHEHR` - Dear Paul, / Dear Marie,
  2. Merci pour ton message. - `mehr-SEE poor to(n) meh-SAHZH` - Thanks for your message.
  3. Je t'écris parce que... - `zhuh tay-KREE pahrs-kuh` - I am writing to you because...
  4. Si tu veux, nous irons au musée. - `see tew VUH noo zee-RO(n) oh mew-ZAY` - If you want, we will go to the museum.
  5. Ensuite, nous avons visité la ville. - `ah(n)-SWEET` - Then we visited the city.
  6. J'espère te voir bientôt. - `zheh-SPEHR tuh VWAHR byeh(n)-TOH` - I hope to see you soon.
  7. À bientôt ! - `ah byeh(n)-TOH` - See you soon!
  8. Je t'embrasse. - `zhuh tah(n)-BRAHS` - Love (lit. I hug you) (closing).
- **Cloze idea:** `Je ne peux pas venir, ___ je travaille.` answer *parce que*, distractors *mais*, *donc*.
- **Conversation:** A reply to a friend's invitation in message form (thanks, accept or refuse with a reason, practical details, closing); read as a short dialogue of two messages.

### fr-30 · Review: A Trip to France · intermediate · `review-final`
- **Grammar:** Tense map: present for facts, futur proche/futur simple for plans, passé composé for events, imparfait for background, plus the one-off `si + imparfait → conditionnel` hope (B1 teaser). Why: a final lesson should consolidate rather than add; the conditional is included only as a set phrase, not a new tense to conjugate.
- **Recycles:** everything. Each dialogue turn should reuse at least one item from lessons 11-29 (and a few from 1-10).
- **Target words (mostly phrases that connect tenses and opinions):**
  1. Pourriez-vous répéter, s'il vous plaît ? - `poo-ryay-voo ray-pay-TAY seel voo PLEH` - Could you repeat, please?
  2. Je me suis perdu(e). - `zhuh muh swee pehr-DEW` - I got lost.
  3. À mon avis, c'est mieux. - `ah mo(n) nah-VEE seh MYUH` - In my opinion, it is better.
  4. Je pense que c'est une bonne idée. - `zhuh pah(n)s kuh seh tewn bohn ee-DAY` - I think it's a good idea.
  5. Si j'avais le temps, je voyagerais. - `see zhah-VEH luh TAH(n) zhuh vwah-yah-zhuh-REH` - If I had time, I would travel.
  6. D'abord, ensuite, enfin - `dah-BOHR ah(n)-SWEET ah(n)-FEH(n)` - First, then, finally.
  7. Qu'est-ce qui s'est passé ? - `kehs-kee seh pah-SAY` - What happened?
  8. C'était super ! - `say-TEH sew-PEHR` - It was great!
- **Cloze idea:** `Hier, je ___ au cinéma.` answer *suis allé*, distractors *vais*, *allais*. (A second cloze may test `Demain, je ___ au marché.`.)
- **Conversation:** A visitor tells a French host about their trip: what they did (past), what the weather was like (imparfait), what they will do tomorrow (futur proche), and what they think (opinion).

## Notes for whoever writes the JSON
- Each lesson has 6-8 targets. Where a target pairs two forms ("il fait chaud / froid"), split into two items if the app needs one phrase per item.
- A few translit entries show two forms (m/f); the existing scheme shows one form per item, so choose one and mention the other in the example if needed.
- Check the pronunciation guides with a native reader before release: they were written by hand in the part1.json scheme, not generated from a dictionary. The ones most worth checking are `-ill-` words (réveille, habille, billet) and the future-tense endings.
- The Arabic and Indonesian translations are not part of this plan.
