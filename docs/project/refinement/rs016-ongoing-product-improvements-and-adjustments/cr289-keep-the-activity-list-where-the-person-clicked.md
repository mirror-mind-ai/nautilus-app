[< RS016](index.md)

# CR289: Keep the Activity List Where the Person Clicked

**Status:** in_progress 2026-11-25 (`fa0f1ed0`); on main, awaiting a look in a dev build on macOS
**Driver:** Navigator
**Requested:** on 2026-11-25, after the field run of CR285: "Eu quero criar um delay de alguns segundos depois que eu clico em um dos itens do tab activity antes da lista ser reordenada. A experiência atual está ruim porque logo que eu clico em uma journey, por exemplo, que acabou de entrar em Done, a lista se move para que a journey seja reposicionada em idle. Aí o usuário sente uma fricção para entender o que aconteceu, porque o esperado era só carregar a conversa sem que o item seja jogado para longe do seu clique."

## Friction

Opening the answer of a Journey that finished changes its state (the answer is seen), which moves it from
Need you to Idle. The Activity list followed at once, so the row left the pointer in the instant of the
click and the person had to work out what had happened when all they had asked for was to open the
conversation.

## What Changed

After a row is chosen, with the pointer or the keyboard, the list keeps the order the person saw for four
seconds (`ACTIVITY_HOLD_MS`), then lets go on its own. Each row still shows its current state and clock,
so the chosen row already reads as seen while it stays where it was. A new choice renews the four seconds.
A row the held order does not know (a Journey that just started) goes to the end of its own group, and a
row that is gone is dropped. The pure part is `holdActivityLayout` and `layoutOfActivity` in
`src/domain/journeyActivity.ts`; the timer and the held layout live in `src/app/JourneyActivityList.tsx`.
No Rust.

## Noted at Review

Four seconds is the assistant's reading of "a few seconds"; it is one constant. The whole order is held,
not only the chosen row, so a Journey that starts or finishes during the hold waits too: moving it would
move the rows under the pointer, which is the friction this removes.

## Falsifier

In the Activity view, open the answer of a Journey that is in Need you: its row stays where it was for a
few seconds and then moves to Idle. If it leaves at once, or stays after about four seconds with no
further click, this CR reopens.

## Evaluation

Test first (red, then green): the held order in five cases in `journeyActivity.test.ts` and the wiring in
`journeyActivityView.test.tsx`. Full suites in a clean environment: vitest 390 files, 3264 passed, 4
skipped; `tsc` clean. Not run in a dev build by the assistant.

## Validation Route

1. `npm run tauri:dev`, Activity view, a Journey with a finished answer under Need you.
2. Click it: the conversation opens and the row stays put for a few seconds, reading as seen.
3. After about four seconds the row moves to Idle without another click.
