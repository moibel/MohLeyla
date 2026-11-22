# Spanish (es) curriculum plan: lessons 11-30

Status: planning only. No lesson JSON written. Lessons es-01..es-10 already exist in `src/data/content/es/part1.json`.

## Sources

Read in full or in the relevant parts (text extracted and inspected):

1. Universidad de Zaragoza, Programación del curso de A2 (https://cursosdeespanol.unizar.es/sites/cursosdeespanol/files/archivos/programacion_general_de_a2_.pdf): PCIC-based A2 inventory of functions, grammar, vocabulary, culture. Grammar list includes present, reflexives, ser/estar, gustar/encantar/preferir, comparatives, DO/IO pronouns, perfecto, indefinido, imperfecto and their contrasts, estar + gerundio, affirmative imperative, impersonal se. No future simple is listed; future is covered via intentions/projects.
2. Universidad de Zaragoza, Programación del curso de A1 (https://cursosdeespanol.unizar.es/sites/cursosdeespanol/files/archivos/programacion_general_de_a1.pdf): A1 already contains regular and irregular present, hay/estar, superlative, gustar/preferir, reflexives, impersonal se, "pasado reciente: pretérito perfecto", verbal periphrases, weather, shops, food, directions.
3. Universidad de Alicante CSI, programa intensivo A2.1 (https://csidiomas.ua.es/images/espanol/modular/programa_intensivo_A2.1.pdf): order of units: language-learning/present, biographies (pretérito indefinido), personality, housing (comparatives, possessive pronouns, gustar/encantar/preferir), then plans.
4. Universidad de Alicante CSI, programa intensivo A2.2 (https://www.csidiomas.ua.es/images/espanol/modular/programa_intensivo_A2.2.pdf): leisure (perfecto vs indefinido, ya/todavía no, ir a, querer/pensar + infinitive), food, health, imperative, imperfecto, imperfecto vs indefinido.
5. Universidad de Alicante CSI, programa intensivo A1.2 (https://www.csidiomas.ua.es/images/espanol/modular/programa_intensivo_A1.2.pdf): A1 second half: gustar/encantar, quantifiers, daily routine, perfecto introduced at the end of A1.
6. Difusión, Aula Internacional Plus 2, programación de 90 sesiones (https://difusion.com/wp-content/uploads/2026/06/auint_plus_2_prog_90h.pdf): unit order of a major PCIC coursebook: 1 el español y tú (present review, desde hace), 2 una vida de película (indefinido), 3 yo soy así, 4 hogar dulce hogar (comparatives), 5 ¿cómo va todo?, 6 guía del ocio (perfecto/indefinido, plans), 7 ¿comes de todo? (object pronouns, impersonal), 8 estamos muy bien, 9 antes y ahora (imperative, imperfecto, imperfecto vs indefinido, estar + gerundio), 10 momentos especiales.
7. Universitat de València, content programme for Aula Internacional Plus 1/2 (https://www.uv.es/centro-idiomas-uv/es/idiomas/curso-seniors/programa-contenidos.html): Plus 1 order (hay/estar, daily routine with irregular and pronominal verbs, food with poner and lo/la/los/las, saber/poder + infinitive, pretérito perfecto) and start of Plus 2.
8. Edinumen, Etapas Plus Acceso A1 index (https://edinumen.es/images/stories/virtuemart/product/plusA1indicealumno.pdf): only skimmed; confirms topic units (family, cities, supermarket) at A1.

Attempted but NOT read: the Instituto Cervantes PCIC / Niveles de referencia pages (cvc.cervantes.es) redirected to a maintenance page, and search results gave only descriptions. The PCIC is therefore used indirectly: sources 1-2 state they follow it, and the Cervantes grammar inventory itself was not verified. Alicante A2 PDFs were read as extracted text (tables are partly garbled but the unit order was recoverable). Aula Internacional Plus 2's per-unit grammar was read from the session plan, not from the student index.

## Decisions

**Levels.** Lessons 11-20 = `elementary`, roughly late A1 into A2.1 (consolidation of the present, the high-frequency verbs, home, city, clothes, food). Lessons 21-30 = `intermediate`, roughly A2.1 to A2.2, with 28-30 touching the start of B1 (narrating in the past, simple future, a first look at "ojalá"/"si" structures). es-07..es-10 already sit at `elementary`, so 11-20 continues at the same level.

**Progression logic.** (1) Finish the present tense before any other tense: regular, then ir/venir/hacer/tener, then stem-changers, then reflexives and yo-irregulars (salgo, pongo). (2) Use topics that naturally carry the grammar: home carries hay vs estar, clothes carries ser vs estar, hobbies carry gustar, weather carries ir a. (3) Pronouns come in two steps: direct (lo/la/los/las) in the restaurant lesson, indirect (me/te/le) in the doctor lesson. (4) Past tenses in a deliberate order: perfecto, then indefinido (regular + ir/ser, then irregular), then imperfecto, then the contrast. (5) Future simple and the capstone come last. Every lesson recycles at least two earlier items (listed under "Recycles").

**Where sources disagree.**
- Perfecto vs indefinido first. Zaragoza A1 and Aula Plus 1 (A1.2) introduce the perfecto first; Alicante A2.1 and Aula Plus 2 teach the indefinido first (biographies) and contrast the two later. We follow the first group (perfecto in es-23, indefinido in es-24/25) because "have done / haven't yet" is short and tied to work and experience, and it avoids irregular stems at first. Human decision point.
- Future simple. None of the A2 programmes read lists it; they cover the future with ir a, querer/pensar + infinitive and time markers. We teach ir a in es-18 and only a light, recognition-first future simple in es-29, flagged as B1-leaning. Could be dropped for a second ir a lesson if the course should stay strictly A2.
- Imperative. Zaragoza A2 and Aula Plus 2 treat the affirmative imperative at A2. es-08 already taught formal commands (siga, gire), so es-26 adds tú commands.
- Object pronouns. Aula Plus 1 introduces lo/la/los/las in A1.2; Zaragoza lists DO/IO pronouns at A2. We place DO at es-20 (end of elementary) and IO at es-22.

**Regional policy.** Neutral standard Spanish, tú/usted/ustedes only, no vosotros forms in lessons (mention only in hints if at all), no voseo in lessons. Pronunciation guide is seseo-style Latin American / neutral, matching part1.json: c/z = s ("cine" = SEE-neh, "gracias" = GRAH-syahs), j/g before e,i = h, ll = y, v = b, ñ = ny, h silent, qu = k, ue = weh, ie = yeh, au = ow, ai/ay = ay; stressed syllable in capitals. Spain vs Latin America differences appear only in `hint`/culture notes (piso vs departamento, billete vs boleto, patatas vs papas, ordenador vs computadora, perfecto vs indefinido for recent past, ¿Diga? vs ¿Bueno?/¿Aló?, "coger" is NOT taught, vosotros mentioned only as "used in Spain").

**Format notes for the writer.** Each lesson lists 8 target items (fits the 6-8 range plus one spare so the writer can drop one). Items with a slash show an alternative, which the writer should split into one target per item. Numbers in lesson 11 are grouped so that each item is one short line of words. Where a target is a fixed phrase whose grammar is not yet taught (marked "chunk"), teach it as a chunk and explain in a later lesson.

**Pitfall list for review.** Accents (¿Qué hora es?, está/esta, tú/tu, sí/si, él/el, más/mas), irregular stems, `había` used only as set phrase in es-28 (full imperfect of haber is not taught).

---

## Overview

| id | Title | Level | Topic slug | Main grammar |
|---|---|---|---|---|
| es-11 | Numbers to 100 and Regular Verbs | elementary | numbers-regular-verbs | Present of regular -ar/-er/-ir |
| es-12 | My Home | elementary | home-hay-estar | hay vs estar |
| es-13 | Going, Coming and Doing | elementary | ir-venir-hacer | ir, venir, hacer, tener expressions |
| es-14 | Wanting, Being Able, Having To | elementary | stem-changing-verbs | e>ie, o>ue; querer/poder/tener que + infinitive |
| es-15 | Clothes, Colours and Describing | elementary | clothes-colours-ser-estar | ser vs estar in depth |
| es-16 | Likes, Hobbies and Sports | elementary | gustar-hobbies | gustar, encantar, interesar |
| es-17 | My Day in Detail | elementary | daily-routine-reflexive | Reflexive verbs, salir/poner, frequency |
| es-18 | Weather, Months and Plans | elementary | weather-months-plans | ir a + infinitive |
| es-19 | Getting Around the City | elementary | city-transport-por-para | por vs para |
| es-20 | At the Restaurant | elementary | restaurant-object-pronouns | lo/la/los/las |
| es-21 | Comparing Things | intermediate | comparing-things | Comparatives and superlatives |
| es-22 | At the Doctor's | intermediate | doctor-advice | me/te/le/les, advice |
| es-23 | Work and Studies | intermediate | work-studies-perfecto | Pretérito perfecto |
| es-24 | Last Weekend, Last Year | intermediate | past-events-indefinido | Pretérito indefinido I |
| es-25 | Travel and Hotels | intermediate | travel-hotel-irregulars | Pretérito indefinido II (irregulars) |
| es-26 | Phone Calls and Invitations | intermediate | phone-invitations-imperative | Imperative tú |
| es-27 | When I Was a Child | intermediate | childhood-imperfecto | Pretérito imperfecto |
| es-28 | Telling a Story | intermediate | storytelling-past-contrast | Imperfecto vs indefinido |
| es-29 | Writing Messages and Future Plans | intermediate | messages-future | Futuro simple, message conventions |
| es-30 | Putting It All Together | intermediate | review-capstone | Choosing the right tense |

---

## es-11 Numbers to 100 and Regular Verbs
- Level: elementary. Topic: `numbers-regular-verbs`.
- Grammar: present tense of regular verbs in -ar, -er, -ir (vivo, vives, vive...). Why: es-03/09 only gave isolated forms (trabajo, me levanto); learners need the full pattern before every other verb lesson, and numbers 11-100 are needed for addresses, prices and ages.
- Recycles: es-04 numbers, es-03 introductions, es-08 dónde.

| Target | Pronunciation | Meaning |
|---|---|---|
| once, doce, trece, catorce, quince | OHN-seh, DOH-seh, TREH-seh, kah-TOHR-seh, KEEN-seh | eleven to fifteen |
| veinte, veintiuno, treinta, cuarenta | BAYN-teh, bayn-TYOO-noh, TRAYN-tah, kwah-REHN-tah | twenty, twenty-one, thirty, forty |
| cincuenta, sesenta, setenta, ochenta, noventa, cien | seen-KWEHN-tah, seh-SEHN-tah, seh-TEHN-tah, oh-CHEHN-tah, noh-BEHN-tah, SYEHN | fifty to a hundred |
| Vivo en una ciudad pequeña. | BEE-boh ehn OO-nah syoo-DAHD peh-KEH-nyah | I live in a small city. |
| ¿Dónde vives? / ¿Dónde vive usted? | DOHN-deh BEE-behs / DOHN-deh BEE-beh oos-TEHD | Where do you live? (tú / usted) |
| Hablo español y un poco de inglés. | AH-bloh ehs-pah-NYOHL ee oon POH-koh deh een-GLEHS | I speak Spanish and a little English. |
| ¿Qué estudias? | keh ehs-TOO-dyahs | What do you study? |
| Mi número de teléfono es el... | mee NOO-meh-roh deh teh-LEH-foh-noh ehs ehl | My phone number is... |

- Cloze idea: "Mi hermano ___ en Madrid." (vive; wrong: vivo, vives).
- Conversation: two new neighbours (tú) exchange where they live, what they study or do, languages, and phone numbers.

## es-12 My Home
- Level: elementary. Topic: `home-hay-estar`.
- Grammar: hay (existence, "there is/are", with indefinite things) vs estar (location of known things): "Hay un parque. El parque está cerca." Why: es-08 only used estar for location; learners now need to say what exists before they say where it is. Sources: Aula Plus 1 lección 3, Zaragoza A1.
- Recycles: es-05 family, es-08 prepositions of place, es-11 numbers.

| Target | Pronunciation | Meaning |
|---|---|---|
| Vivo en un apartamento. | BEE-boh ehn oon ah-pahr-tah-MEHN-toh | I live in an apartment. (Spain: piso; Mexico: departamento) |
| ¿Cuántas habitaciones tiene? | KWAHN-tahs ah-bee-tah-SYOH-nehs TYEH-neh | How many rooms does it have? |
| Hay un sofá en la sala. | ay oon soh-FAH ehn lah SAH-lah | There is a sofa in the living room. |
| ¿Hay un baño aquí? | ay oon BAH-nyoh ah-KEE | Is there a bathroom here? |
| La cocina está al fondo. | lah koh-SEE-nah ehs-TAH ahl FOHN-doh | The kitchen is at the back. |
| El dormitorio | ehl dohr-mee-TOH-ryoh | the bedroom |
| La mesa y las sillas | lah MEH-sah ee lahs SEE-yahs | the table and the chairs |
| El gato está debajo de la mesa. | ehl GAH-toh ehs-TAH deh-BAH-hoh deh lah MEH-sah | The cat is under the table. |

- Cloze idea: "En mi casa ___ tres habitaciones." (hay; wrong: está, están).
- Conversation: viewing a flat with an agent (usted): rooms, furniture, "¿Hay balcón?".

## es-13 Going, Coming and Doing
- Level: elementary. Topic: `ir-venir-hacer`.
- Grammar: the irregular presents of ir (voy, vas, va...), venir (vengo, vienes...) and hacer (hago, haces...), with a/de/en and tener expressions (tengo prisa/sed/sueño). Why: these are the most frequent verbs and the base for ir a (es-18) and later tenses.
- Recycles: es-08 places, es-09 days, es-06 tengo hambre.

| Target | Pronunciation | Meaning |
|---|---|---|
| ¿Adónde vas? | ah-DOHN-deh bahs | Where are you going? |
| Voy al trabajo en autobús. | boy ahl trah-BAH-hoh ehn ow-toh-BOOS | I go to work by bus. |
| Voy a pie. | boy ah PYEH | I go on foot. |
| Vengo de la universidad. | BEHN-goh deh lah oo-nee-behr-see-DAHD | I come from the university. |
| ¿Vienes con nosotros? | BYEH-nehs kohn noh-SOH-trohs | Are you coming with us? |
| ¿Qué haces los sábados? | keh AH-sehs lohs SAH-bah-dohs | What do you do on Saturdays? |
| Hago deporte. | AH-goh deh-POHR-teh | I do sport. |
| Tengo prisa. | TEHN-goh PREE-sah | I'm in a hurry. |

- Cloze idea: "Hoy ___ al cine con mis amigos." (voy; wrong: vas, va).
- Conversation: friends on a Friday evening: where are you going, what are you doing, do you want to come.

## es-14 Wanting, Being Able, Having To
- Level: elementary. Topic: `stem-changing-verbs`.
- Grammar: stem-changing verbs (e>ie: querer, preferir, empezar; o>ue: poder, dormir, volver), not in nosotros; with querer/poder/tener que + infinitive. Why: lets learners make requests and say obligations; builds on quisiera/quiero in es-06.
- Recycles: es-06 quiero, es-09 hours, es-13 tengo.

| Target | Pronunciation | Meaning |
|---|---|---|
| Quiero ir al cine. | KYEH-roh eer ahl SEE-neh | I want to go to the cinema. |
| ¿Puedes ayudarme? | PWEH-dehs ah-yoo-DAHR-meh | Can you help me? |
| ¿Puedo pasar? | PWEH-doh pah-SAHR | May I come in? |
| Prefiero el té. | preh-FYEH-roh ehl TEH | I prefer tea. |
| Tengo que estudiar. | TEHN-goh keh ehs-too-DYAHR | I have to study. |
| No entiendo. | noh ehn-TYEHN-doh | I don't understand. |
| ¿A qué hora empieza? | ah keh OH-rah ehm-PYEH-sah | What time does it start? |
| Vuelvo a casa a las seis. | BWEHL-boh ah KAH-sah ah lahs SAYS | I get home at six. |

- Cloze idea: "¿___ ayudarme, por favor?" (Puedes; wrong: Puedo, Pueden).
- Conversation: a student asks the teacher (usted) if she can repeat, and arranges when the exam starts.

## es-15 Clothes, Colours and Describing
- Level: elementary. Topic: `clothes-colours-ser-estar`.
- Grammar: ser vs estar in depth: ser for identity, qualities, material, origin; estar for states, conditions, results; adjectives agree in gender and number; some adjectives change meaning (ser aburrido / estar aburrido). Why: es-03 gave only the basics; clothes and descriptions are the natural place to contrast.
- Recycles: es-07 prices, es-05 family adjectives, es-03 ser/estar.

| Target | Pronunciation | Meaning |
|---|---|---|
| La camisa blanca | lah kah-MEE-sah BLAHN-kah | the white shirt |
| Los pantalones negros | lohs pahn-tah-LOH-nehs NEH-grohs | the black trousers |
| Los zapatos rojos | lohs sah-PAH-tohs RROH-hohs | the red shoes |
| Una chaqueta azul | OO-nah chah-KEH-tah ah-SOOL | a blue jacket |
| El vestido verde | ehl behs-TEE-doh BEHR-deh | the green dress |
| ¿Qué talla usa? | keh TAH-yah OO-sah | What size do you wear? |
| ¿Me lo puedo probar? (chunk) | meh loh PWEH-doh proh-BAHR | Can I try it on? |
| Es aburrido. / Está aburrido. | ehs ah-boo-RREE-doh / ehs-TAH ah-boo-RREE-doh | He is boring. / He is bored. |

- Cloze idea: "Hoy mi hermana ___ muy cansada." (está; wrong: es, son).
- Conversation: clothes shop (usted): colour, size, trying on, price.

## es-16 Likes, Hobbies and Sports
- Level: elementary. Topic: `gustar-hobbies`.
- Grammar: gustar, encantar, interesar: indirect pronoun + verb that agrees with the thing liked (me gusta leer, me gustan los deportes); a mí/a ti for emphasis; también/tampoco. Why: expresses opinion; es-06 used only "me gustaría".
- Recycles: es-06 me gustaría, es-09 days, es-13 hacer.

| Target | Pronunciation | Meaning |
|---|---|---|
| Me gusta leer. | meh GOOS-tah leh-EHR | I like reading. |
| Me gustan los deportes. | meh GOOS-tahn lohs deh-POHR-tehs | I like sports. |
| Me encanta la música. | meh ehn-KAHN-tah lah MOO-see-kah | I love music. |
| ¿Te gusta bailar? | teh GOOS-tah bay-LAHR | Do you like dancing? |
| A mí también. / A mí tampoco. | ah MEE tahm-BYEHN / ah MEE tahm-POH-koh | Me too. / Me neither. |
| No me gusta nada correr. | noh meh GOOS-tah NAH-dah koh-RREHR | I don't like running at all. |
| Juego al fútbol los domingos. | HWEH-goh ahl FOOT-bohl lohs doh-MEEN-gohs | I play football on Sundays. |
| ¿Qué haces en tu tiempo libre? | keh AH-sehs ehn too TYEHM-poh LEE-breh | What do you do in your free time? |

- Cloze idea: "A mí ___ gustan los gatos." (me; wrong: te, le) or "Me ___ los libros." (gustan; wrong: gusta).
- Conversation: two colleagues compare hobbies; they find one in common.

## es-17 My Day in Detail
- Level: elementary. Topic: `daily-routine-reflexive`.
- Grammar: reflexive verbs (me, te, se, nos, se) with the pronoun matching the subject; yo-irregulars salgo, pongo; adverbs of frequency (siempre, a veces, nunca). Why: es-09 introduced "me levanto" as a chunk; here the pattern is explained.
- Recycles: es-09 time and days, es-13 hacer, es-11 regular verbs.

| Target | Pronunciation | Meaning |
|---|---|---|
| Me despierto a las siete. | meh dehs-PYEHR-toh ah lahs SYEH-teh | I wake up at seven. |
| Me ducho y me visto. | meh DOO-choh ee meh BEES-toh | I shower and get dressed. |
| Salgo de casa a las ocho. | SAHL-goh deh KAH-sah ah lahs OH-choh | I leave home at eight. |
| Pongo la mesa. | POHN-goh lah MEH-sah | I set the table. |
| Siempre desayuno en casa. | SYEHM-preh deh-sah-YOO-noh ehn KAH-sah | I always have breakfast at home. |
| A veces ceno tarde. | ah BEH-sehs SEH-noh TAHR-deh | Sometimes I have dinner late. |
| Primero, luego, después | pree-MEH-roh, LWEH-goh, dehs-PWEHS | first, then, after |
| Me acuesto a las once. | meh ah-KWEHS-toh ah lahs OHN-seh | I go to bed at eleven. |

- Cloze idea: "Ella ___ a las ocho." (se levanta; wrong: me levanta, se levantan).
- Conversation: describing a typical weekday to a flatmate.

## es-18 Weather, Months and Plans
- Level: elementary. Topic: `weather-months-plans`.
- Grammar: ir a + infinitive for plans and near future (voy a viajar, va a llover); hace + weather noun. Why: ties weather to forecasts and plans; ir (es-13) is now known; this is the usual first future in A2 courses (Alicante A2.2, Aula Plus 2).
- Recycles: es-09 days, es-13 ir, es-04 numbers (dates).

| Target | Pronunciation | Meaning |
|---|---|---|
| ¿Qué tiempo hace? | keh TYEHM-poh AH-seh | What's the weather like? |
| Hace calor. / Hace frío. | AH-seh kah-LOHR / AH-seh FREE-oh | It's hot. / It's cold. |
| Hoy llueve. | oy YWEH-beh | It's raining today. |
| Hoy está nublado. | oy ehs-TAH noo-BLAH-doh | It's cloudy today. |
| el verano, el invierno | ehl beh-RAH-noh, ehl een-BYEHR-noh | summer, winter |
| Es el cinco de mayo. | ehs ehl SEEN-koh deh MAH-yoh | It's the fifth of May. |
| Voy a viajar en julio. | boy ah byah-HAHR ehn HOO-lyoh | I'm going to travel in July. |
| Mañana va a llover. | mah-NYAH-nah bah ah yoh-BEHR | It's going to rain tomorrow. |

- Cloze idea: "Mañana ___ a llover." (va; wrong: voy, vas).
- Conversation: two friends decide whether to have a picnic on Saturday by checking the forecast.

## es-19 Getting Around the City
- Level: elementary. Topic: `city-transport-por-para`.
- Grammar: por (through, cause, "thanks for") vs para (destination, purpose); secondary: saber for "know information" in ¿Sabe dónde está...? Why: transport language makes both prepositions concrete; es-08 only used places.
- Recycles: es-08 directions, es-13 ir, es-07 tickets/prices.

| Target | Pronunciation | Meaning |
|---|---|---|
| ¿Cómo puedo llegar al centro? | KOH-moh PWEH-doh yeh-GAHR ahl SEHN-troh | How can I get to the centre? |
| ¿Este autobús va al centro? | EHS-teh ow-toh-BOOS bah ahl SEHN-troh | Does this bus go to the centre? |
| Un billete de ida y vuelta | oon bee-YEH-teh deh EE-dah ee BWEHL-tah | a return ticket (LatAm: boleto) |
| Este tren es para Sevilla. | EHS-teh trehn ehs PAH-rah seh-BEE-yah | This train is for Seville. |
| Voy por la avenida principal. | boy pohr lah ah-beh-NEE-dah preen-see-PAHL | I go along the main avenue. |
| ¿Sabe dónde está la parada? | SAH-beh DOHN-deh ehs-TAH lah pah-RAH-dah | Do you know where the stop is? |
| Para ir al museo, tome el metro. | PAH-rah eer ahl moo-SEH-oh, TOH-meh ehl MEH-troh | To go to the museum, take the metro. |
| Gracias por su ayuda. | GRAH-syahs pohr soo ah-YOO-dah | Thanks for your help. |

- Cloze idea: "Gracias ___ su ayuda." (por; wrong: para, a).
- Conversation: at a metro ticket window (usted): asking for the line, a return ticket, thanking.

## es-20 At the Restaurant
- Level: elementary. Topic: `restaurant-object-pronouns`.
- Grammar: direct object pronouns lo, la, los, las, placed before the conjugated verb ("¿El pescado? Lo quiero con ensalada"). Why: avoids repeating nouns when ordering and finishes elementary food vocabulary from es-06; Aula Plus 1 (A1.2) and Zaragoza A2 both teach it here.
- Recycles: es-06 café, quisiera, la cuenta; es-14 querer; es-07 prices.

| Target | Pronunciation | Meaning |
|---|---|---|
| ¿Me trae la carta, por favor? | meh TRAH-eh lah KAHR-tah pohr fah-BOHR | Could you bring me the menu? (LatAm: menú) |
| ¿Qué recomienda? | keh rreh-koh-MYEHN-dah | What do you recommend? |
| De primero, una sopa. | deh pree-MEH-roh, OO-nah SOH-pah | For the first course, a soup. |
| De segundo, pollo con arroz. | deh seh-GOON-doh, POH-yoh kohn ah-RROHS | For the main, chicken with rice. |
| Lo quiero con ensalada. | loh KYEH-roh kohn ehn-sah-LAH-dah | I want it with salad. |
| La quiero sin cebolla. | lah KYEH-roh seen seh-BOH-yah | I want it without onion. |
| Soy vegetariano. / Soy vegetariana. | soy beh-heh-tah-RYAH-noh / soy beh-heh-tah-RYAH-nah | I'm vegetarian. |
| Agua sin gas, por favor. | AH-gwah seen gahs pohr fah-BOHR | Still water, please. |

- Cloze idea: "¿La ensalada? ___ quiero sin cebolla." (La; wrong: Lo, Las).
- Conversation: ordering a three-course meal with dietary preferences, then asking for the bill.

## es-21 Comparing Things
- Level: intermediate. Topic: `comparing-things`.
- Grammar: comparatives más/menos... que, tan... como, irregular mejor/peor, and the superlative el más... de. Why: needed to choose, recommend and evaluate; sources place comparatives in A2.1 (Zaragoza A2, Alicante A2.1 housing unit, Aula Plus 2 unit 4).
- Recycles: es-07 caro/barato, es-12 home, es-15 clothes, es-19 city.

| Target | Pronunciation | Meaning |
|---|---|---|
| más grande que | mahs GRAHN-deh keh | bigger than |
| menos caro que | MEH-nohs KAH-roh keh | less expensive than |
| tan bueno como | tahn BWEH-noh KOH-moh | as good as |
| mejor / peor | meh-HOHR / peh-OHR | better / worse |
| Es el más barato. | ehs ehl mahs bah-RAH-toh | It's the cheapest. |
| Es la más bonita de la ciudad. | ehs lah mahs boh-NEE-tah deh lah syoo-DAHD | It's the prettiest in the city. |
| Esta camisa es más cara que esa. | EHS-tah kah-MEE-sah ehs mahs KAH-rah keh EH-sah | This shirt is more expensive than that one. |
| Prefiero este porque es más cómodo. | preh-FYEH-roh EHS-teh POHR-keh ehs mahs KOH-moh-doh | I prefer this one because it's more comfortable. |

- Cloze idea: "Este hotel es ___ que el otro." (mejor; wrong: más bueno, bueno).
- Conversation: comparing two flats or two phones with a friend, then deciding.

## es-22 At the Doctor's
- Level: intermediate. Topic: `doctor-advice`.
- Grammar: indirect object pronouns me, te, le, nos, les ("¿Qué le pasa?", "Le duele...", "Le recomiendo descansar") and advice with tener que/deber + infinitive. Why: es-10 used "me duele" as a chunk; the doctor (usted) naturally uses le.
- Recycles: es-10 me duele, es-14 tener que, es-16 me gusta (same pronouns).

| Target | Pronunciation | Meaning |
|---|---|---|
| ¿Qué le pasa? | keh leh PAH-sah | What's the matter? |
| Me siento mal. | meh SYEHN-toh mahl | I feel ill. |
| Tengo fiebre y tos. | TEHN-goh FYEH-breh ee tohs | I have a fever and a cough. |
| ¿Le duele aquí? | leh DWEH-leh ah-KEE | Does it hurt here? |
| Le recomiendo descansar. | leh rreh-koh-MYEHN-doh dehs-kahn-SAHR | I recommend that you rest. |
| Tiene que tomar este medicamento. | TYEH-neh keh toh-MAHR EHS-teh meh-dee-kah-MEHN-toh | You have to take this medicine. |
| Quisiera pedir una cita. | kee-SYEH-rah peh-DEER OO-nah SEE-tah | I'd like to make an appointment. |
| la receta, la farmacia | lah rreh-SEH-tah, lah fahr-MAH-syah | the prescription, the pharmacy |

- Cloze idea: "Doctor, ___ duele la garganta." (me; wrong: le, lo).
- Conversation: doctor's appointment (usted): symptoms, questions, prescription.

## es-23 Work and Studies
- Level: intermediate. Topic: `work-studies-perfecto`.
- Grammar: pretérito perfecto: haber (he, has, ha, hemos, han) + participle (-ado/-ido; hecho, escrito, visto); with ya, todavía no, alguna vez. Why: link to CV and experiences; short, regular pattern, so the first past tense (see Decisions). Hint: Spain uses it for recent past; much of Latin America uses the indefinido instead.
- Recycles: es-03 professions, es-09 time, es-11 studies, es-13 hacer.

| Target | Pronunciation | Meaning |
|---|---|---|
| ¿A qué te dedicas? | ah keh teh deh-DEE-kahs | What do you do for work? |
| Trabajo como ingeniero. | trah-BAH-hoh KOH-moh een-heh-NYEH-roh | I work as an engineer. |
| He trabajado en un hotel. | eh trah-bah-HAH-doh ehn oon oh-TEHL | I have worked in a hotel. |
| ¿Has estudiado inglés? | ahs ehs-too-DYAH-doh een-GLEHS | Have you studied English? |
| Ya he hablado con mi jefe. | yah eh ah-BLAH-doh kohn mee HEH-feh | I have already spoken to my boss. |
| Todavía no he terminado. | toh-dah-BEE-ah noh eh tehr-mee-NAH-doh | I haven't finished yet. |
| Tengo una entrevista de trabajo. | TEHN-goh OO-nah ehn-treh-BEES-tah deh trah-BAH-hoh | I have a job interview. |
| el currículum | ehl koo-RREE-koo-loom | the CV |

- Cloze idea: "Todavía no ___ el informe." (he escrito; wrong: escribo, escribí).
- Conversation: a job interview (usted): experience, languages, studies.

## es-24 Last Weekend, Last Year
- Level: intermediate. Topic: `past-events-indefinido`.
- Grammar: pretérito indefinido of regular verbs (-é, -aste, -ó...; -í, -iste, -ió...) plus ir/ser (fui, fuiste, fue...) with ayer, anoche, el año pasado, hace + time. Why: narrates finished events; follows the perfecto and uses already-known verbs. Source order: Alicante A2.1, Aula Plus 2 unit 2.
- Recycles: es-09 days, es-16 hobbies, es-23 perfecto (contrast: "esta semana he..." vs "ayer...").

| Target | Pronunciation | Meaning |
|---|---|---|
| Ayer trabajé hasta las seis. | ah-YEHR trah-bah-HEH AHS-tah lahs SAYS | Yesterday I worked until six. |
| Anoche comí con mi familia. | ah-NOH-cheh koh-MEE kohn mee fah-MEE-lyah | Last night I ate with my family. |
| El año pasado viví en Madrid. | ehl AH-nyoh pah-SAH-doh bee-BEE ehn mah-DREED | Last year I lived in Madrid. |
| Me levanté tarde. | meh leh-bahn-TEH TAHR-deh | I got up late. |
| Fui al cine. | fwee ahl SEE-neh | I went to the cinema. |
| Fue una película genial. | fweh OO-nah peh-LEE-koo-lah heh-NYAHL | It was a great film. |
| hace dos días | AH-seh dohs DEE-ahs | two days ago |
| ¿Qué hiciste el sábado? (chunk) | keh ee-SEES-teh ehl SAH-bah-doh | What did you do on Saturday? |

- Cloze idea: "Ayer ___ en un restaurante nuevo." (comí; wrong: como, comeré).
- Conversation: Monday morning chat about the weekend.

## es-25 Travel and Hotels
- Level: intermediate. Topic: `travel-hotel-irregulars`.
- Grammar: irregular indefinido stems (estuve, tuve, hice, pude, vine, dije, puse, quise) with no accent in -e/-o endings. Why: travel stories need them (estuve, hice, tuve que, pude); hotel check-in recycles requests.
- Recycles: es-19 transport, es-18 months, es-12 rooms, es-24 indefinido.

| Target | Pronunciation | Meaning |
|---|---|---|
| Tengo una reserva a nombre de... | TEHN-goh OO-nah rreh-SEHR-bah ah NOHM-breh deh | I have a reservation in the name of... |
| Una habitación doble con baño | OO-nah ah-bee-tah-SYOHN DOH-bleh kohn BAH-nyoh | a double room with bathroom |
| ¿Está incluido el desayuno? | ehs-TAH een-kloo-EE-doh ehl deh-sah-YOO-noh | Is breakfast included? |
| ¿A qué hora es la salida? | ah keh OH-rah ehs lah sah-LEE-dah | What time is check-out? |
| El verano pasado estuve en Perú. | ehl beh-RAH-noh pah-SAH-doh ehs-TOO-beh ehn peh-ROO | Last summer I was in Peru. |
| Tuve que cambiar el vuelo. | TOO-beh keh kahm-BYAHR ehl BWEH-loh | I had to change the flight. |
| Hice muchas fotos. | EE-seh MOO-chahs FOH-tohs | I took lots of photos. |
| Vine en avión. | BEE-neh ehn ah-BYOHN | I came by plane. |

- Cloze idea: "El año pasado ___ en Chile dos semanas." (estuve; wrong: estoy, estaba).
- Conversation: hotel check-in (usted), then a short account of the trip.

## es-26 Phone Calls and Invitations
- Level: intermediate. Topic: `phone-invitations-imperative`.
- Grammar: affirmative imperative tú (habla, come, escribe; irregular ven, di, pon, sal, haz, ve) with attached pronouns (llámame, dime). Why: invitations and calls use short commands; es-08 gave formal commands, so contrast tú vs usted. Sources: Zaragoza A2, Aula Plus 2 unit 9.
- Recycles: es-14 puedo/quiero, es-09 time, es-18 plans, es-22 pronouns.

| Target | Pronunciation | Meaning |
|---|---|---|
| ¿Diga? / ¿Dígame? | DEE-gah / DEE-gah-meh | Hello? (answering the phone; Mexico: ¿Bueno?) |
| ¿Puedo hablar con Ana? | PWEH-doh ah-BLAHR kohn AH-nah | Can I speak to Ana? |
| ¿Quiere dejar un mensaje? | KYEH-reh deh-HAHR oon mehn-SAH-heh | Would you like to leave a message? |
| ¿Quieres venir a mi fiesta? | KYEH-rehs beh-NEER ah mee FYEHS-tah | Do you want to come to my party? |
| Sí, con mucho gusto. | see, kohn MOO-choh GOOS-toh | Yes, with pleasure. |
| Lo siento, no puedo. | loh SYEHN-toh, noh PWEH-doh | Sorry, I can't. |
| Llámame mañana. | YAH-mah-meh mah-NYAH-nah | Call me tomorrow. |
| Ven a las ocho. | behn ah lahs OH-choh | Come at eight. |

- Cloze idea: "___ a mi casa a las ocho." (Ven; wrong: Vienes, Venir).
- Conversation: phone call: inviting a friend, the friend declines, they agree on another day.

## es-27 When I Was a Child
- Level: intermediate. Topic: `childhood-imperfecto`.
- Grammar: pretérito imperfecto (-aba, -ía; irregular era, iba, veía) for habits and descriptions in the past, with antes, de niño, cada verano. Why: completes the past system (see order in Aula Plus 2 unit 9 "Antes y ahora"). Contrasted with the indefinido only in es-28.
- Recycles: es-05 family, es-16 hobbies, es-17 routine, es-12 home.

| Target | Pronunciation | Meaning |
|---|---|---|
| Cuando era niño, vivía en un pueblo. | KWAHN-doh EH-rah NEE-nyoh, bee-BEE-ah ehn oon PWEH-bloh | When I was a child I lived in a village. |
| Antes jugaba mucho al fútbol. | AHN-tehs hoo-GAH-bah MOO-choh ahl FOOT-bohl | I used to play football a lot. |
| Íbamos a la playa cada verano. | EE-bah-mohs ah lah PLAH-yah KAH-dah beh-RAH-noh | We went to the beach every summer. |
| Mi abuela cocinaba muy bien. | mee ah-BWEH-lah koh-see-NAH-bah mwee byehn | My grandmother cooked very well. |
| Tenía el pelo largo. | teh-NEE-ah ehl PEH-loh LAHR-goh | I had long hair. |
| Era un niño tímido. | EH-rah oon NEE-nyoh TEE-mee-doh | I was a shy child. |
| Antes... ahora... | AHN-tehs... ah-OH-rah | Before... now... |
| De pequeño | deh peh-KEH-nyoh | as a child |

- Cloze idea: "De niño, ___ en el campo." (vivía; wrong: viví, vivo).
- Conversation: two friends compare their lives before and now.

## es-28 Telling a Story
- Level: intermediate (start of B1 skills). Topic: `storytelling-past-contrast`.
- Grammar: imperfecto for background and ongoing action; indefinido for events that move the story on ("Estaba en casa cuando sonó el teléfono"); connectors de repente, entonces, mientras, al final, por eso. Why: the main A2.2 target (Alicante A2.2, Aula Plus 2 unit 9).
- Recycles: es-24 indefinido, es-27 imperfecto, es-09 time, es-18 weather.

| Target | Pronunciation | Meaning |
|---|---|---|
| Estaba en casa cuando sonó el teléfono. | ehs-TAH-bah ehn KAH-sah KWAHN-doh soh-NOH ehl teh-LEH-foh-noh | I was at home when the phone rang. |
| Había mucha gente. (chunk) | ah-BEE-ah MOO-chah HEHN-teh | There were lots of people. |
| De repente | deh rreh-PEHN-teh | suddenly |
| Entonces | ehn-TOHN-sehs | then |
| Mientras comía, llegó mi hermano. | MYEHN-trahs koh-MEE-ah, yeh-GOH mee ehr-MAH-noh | While I was eating, my brother arrived. |
| ¿Qué pasó? | keh pah-SOH | What happened? |
| Por eso me acosté temprano. | pohr EH-soh meh ah-kohs-TEH tehm-PRAH-noh | That's why I went to bed early. |
| Al final | ahl fee-NAHL | in the end |

- Cloze idea: "Mientras ___ la cena, sonó el teléfono." (preparaba; wrong: preparé, preparo).
- Conversation: someone tells a friend about a funny or unlucky day (lost keys, rain, missed bus).

## es-29 Writing Messages and Future Plans
- Level: intermediate. Topic: `messages-future`.
- Grammar: futuro simple, light version: regular forms (-é, -ás, -á, -emos, -án added to the infinitive) and a handful of irregulars (tendré, haré, podré, saldré, vendré), compared with ir a; plus message conventions (formal vs informal openings and closings). Why: tests plans and promises in writing. Note: B1-leaning; none of the A2 programmes read lists futuro simple.
- Recycles: es-18 ir a, es-26 imperative, es-02 politeness, es-13 venir.

| Target | Pronunciation | Meaning |
|---|---|---|
| El año que viene viajaré a México. | ehl AH-nyoh keh BYEH-neh byah-hah-REH ah MEH-hee-koh | Next year I will travel to Mexico. |
| Tendré más tiempo. | tehn-DREH mahs TYEHM-poh | I will have more time. |
| Querida Ana: / Hola, Pedro: | keh-REE-dah AH-nah / OH-lah, PEH-droh | Dear Ana: / Hi, Pedro: (informal) |
| Estimado señor García: | ehs-tee-MAH-doh seh-NYOHR gahr-SEE-ah | Dear Mr García: (formal) |
| Te escribo para decirte que... | teh ehs-KREE-boh PAH-rah deh-SEER-teh keh | I'm writing to tell you that... |
| Espero tu respuesta. | ehs-PEH-roh too rrehs-PWEHS-tah | I'm waiting for your reply. |
| Hablaremos pronto. | ah-blah-REH-mohs PROHN-toh | We'll talk soon. |
| Un abrazo / Atentamente | oon ah-BRAH-soh / ah-tehn-tah-MEHN-teh | Best wishes (informal) / Sincerely (formal) |

- Cloze idea: "El año que viene ___ en otra ciudad." (viviré; wrong: vivía, viví).
- Conversation (text chat): friends arrange a visit by message: dates, a plan, a promise to call.

## es-30 Putting It All Together
- Level: intermediate. Topic: `review-capstone`.
- Grammar: choosing the right tense for what you mean: presente (habits), perfecto (experience up to now), indefinido (finished event), imperfecto (background/habit), ir a or future (plans). No new forms; a quick first look at "ojalá" and a hint of the conditional as bridge to B1. Why: consolidation and a signpost for what comes next.
- Recycles: all earlier topics, especially es-13, es-18, es-23, es-24, es-27, es-29.

| Target | Pronunciation | Meaning |
|---|---|---|
| ¿Qué has hecho hoy? | keh ahs EH-choh oy | What have you done today? |
| Ayer fui a casa de unos amigos. | ah-YEHR fwee ah KAH-sah deh OO-nohs ah-MEE-gohs | Yesterday I went to some friends' house. |
| Cuando era niño, vivía cerca del mar. | KWAHN-doh EH-rah NEE-nyoh, bee-BEE-ah SEHR-kah dehl mahr | When I was a child I lived near the sea. |
| Este verano voy a viajar a Perú. | EHS-teh beh-RAH-noh boy ah byah-HAHR ah peh-ROO | This summer I'm going to travel to Peru. |
| Hace dos años que estudio español. | AH-seh dohs AH-nyohs keh ehs-TOO-dyoh ehs-pah-NYOHL | I've been studying Spanish for two years. |
| Me encantaría conocer Argentina. | meh ehn-kahn-tah-REE-ah koh-noh-SEHR ahr-hehn-TEE-nah | I'd love to visit Argentina. |
| Ojalá haga buen tiempo. | oh-hah-LAH AH-gah bwehn TYEHM-poh | I hope the weather is good. |
| Si tengo tiempo, iré. | see TEHN-goh TYEHM-poh, ee-REH | If I have time, I'll go. |

- Cloze idea: "Ayer ___ al mercado y compré fruta." (fui; wrong: voy, iba).
- Conversation: a longer call between two friends planning and recounting a trip: what they have done, what they did, what they will do.
