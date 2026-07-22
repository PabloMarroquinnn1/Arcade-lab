# 09 – Gitflow en este repo

Gitflow completo (con ramas `release/*` y `hotfix/*`) es mucho para un proyecto solo. Usamos una
versión simplificada, con dos ramas fijas y ramas temporales:

## Las ramas fijas

- **`main`** — siempre es lo que está (o va a estar) corriendo en el servidor. No se trabaja
  directo acá.
- **`develop`** — rama de integración. Todo lo nuevo se junta aquí primero y se prueba antes de
  pasar a producción.

## Las ramas temporales: `feature/*`

Cada cosa nueva (un juego, una sección de docs, un cambio de infra) se hace en su propia rama,
creada desde `develop`:

```bash
git checkout develop
git pull
git checkout -b feature/juego-snake
# ... trabajas, haces commits ...
git push -u origin feature/juego-snake
```

Cuando funciona, se mergea de vuelta a `develop` (en equipo esto sería un Pull Request en GitHub;
solo, puede ser merge directo):

```bash
git checkout develop
git merge --no-ff feature/juego-snake
git push origin develop
git branch -d feature/juego-snake
```

`--no-ff` fuerza a que quede un commit de merge visible, aunque se pudiera hacer fast-forward — así
el historial de `develop` muestra claramente "acá se integró la feature X", en vez de mezclarse
como si siempre hubiera sido lineal.

## Pasar de `develop` a `main` (release)

Cuando `develop` tiene un conjunto de cosas ya probadas y quieres que eso sea lo que corre en el
servidor:

```bash
git checkout main
git merge --no-ff develop
git push origin main
```

Y en el servidor: `git pull origin main && docker compose up --build -d` (ver
[08](08-docker-y-despliegue.md)).

## Resumen visual

```
feature/juego-pong    ----\
                            \
feature/docs-aprende  ------> develop -----> main -----> (servidor)
                            /
feature/juego-snake   ----/
```
