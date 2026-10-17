# assets-src — arte original (antes do processamento)

Largue aqui os PNGs grandes gerados por IA. O `npm run art:import` reduz para a
grade do jogo, unifica a paleta e monta os spritesheets em
`client/public/assets/`.

```
assets-src/tiles/01-floor-wood.png    assets-src/chars/ceo-down-0.png
assets-src/tiles/02-wall.png          assets-src/chars/ceo-down-1.png
assets-src/tiles/03-desk.png          assets-src/chars/ceo-down-2.png
assets-src/tiles/04-meeting-table.png assets-src/chars/ceo-left-0.png
assets-src/tiles/05-plant.png         ...
assets-src/tiles/06-grass.png
assets-src/tiles/07-carpet-teal.png
assets-src/tiles/08-carpet-blue.png
```

Nada daqui vai para o build — só o resultado processado vai.
