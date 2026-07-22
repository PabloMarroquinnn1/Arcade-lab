# 13 – Gitflow en este repo

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

Cuando funciona, se mergea de vuelta a `develop`. En un equipo esto normalmente se hace con un
**Pull Request** en GitHub — pedís que revisen tus cambios antes de sumarlos a `develop`. Trabajando
solo, ese paso de revisión no aplica, así que se puede mergear directo:

```bash
git checkout develop
git merge --no-ff feature/juego-snake
git push origin develop
git branch -d feature/juego-snake
```

Por defecto, si `develop` no cambió mientras trabajabas en tu rama, git haría un **fast-forward**:
movería el puntero de `develop` para adelante sin dejar rastro de que existió una rama separada —
como si siempre hubieras escrito el código directo ahí. `--no-ff` ("no fast-forward") evita eso a
propósito, forzando que quede un commit de merge visible, para que el historial de `develop`
muestre claramente "acá se integró la feature X".

## Pasar de `develop` a `main` (release)

Cuando `develop` tiene un conjunto de cosas ya probadas y quieres que eso sea lo que corre en el
servidor:

```bash
git checkout main
git merge --no-ff develop
git push origin main
```

Y en el servidor: `git pull origin main && docker compose up --build -d` (ver
[12](12-docker-y-despliegue.md)).

## Resumen visual

```
feature/juego-pong    ----\
                            \
feature/docs-aprende  ------> develop -----> main -----> (servidor)
                            /
feature/juego-snake   ----/
```
