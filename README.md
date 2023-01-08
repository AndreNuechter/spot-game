# The Spot Game

An online version of the [Spot Game](https://en.wikipedia.org/wiki/Spot:_The_Video_Game) and a "re-launch" of an earlier [project of mine](https://codepen.io/AndreNuechter/pen/bmJLVr).

[Play it online](https://andrenuechter.github.io/spot-game/)

## Rules

2 - 4 Players can play.

The game starts with each player getting a piece in one of the corners of the board.

Players then take turns.

During a turn, a player picks a piece with at least one free cell one or two cells off, and moves that piece there.
If the chosen destination is one cell off, a new piece is spawned there, else the original piece is moved there.
Enemy pieces adjacent to the newly occupied cell get converted into player pieces.
If a player has no freedoms, their turn just ends.

The game is over once only one player remains or the board is filled.

The player with the most pieces in the end wins.