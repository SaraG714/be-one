# NestJS Workshop - Respuestas a las preguntas

## Q1 - Dead route diagnosis

Sin un decorador de ruta como `@Get()`, el metodo `findAll()` es simplemente un metodo normal de la clase, no un handler HTTP. NestJS no lo registra como endpoint. Al hacer `GET /tasks`, NestJS no encuentra ninguna ruta que coincida y responde con un **404 Not Found** con el body:

```json
{
  "statusCode": 404,
  "message": "Cannot GET /tasks",
  "error": "Not Found"
}
```

Para solucionarlo se debe agregar el decorador `@Get()` encima del metodo:

```typescript
@Get()
findAll() {
  return this.tasksService.findAll();
}
```

---

## Q2 - When `transform: true` is not enough

Aunque `transform: true` convierte tipos automaticamente, lo hace **despues** de que el body pasa por el ValidationPipe. Sin embargo, los parametros de ruta (`@Param`) llegan siempre como **strings** desde la URL. `transform: true` puede convertirlos, pero `ParseIntPipe` ofrece una ventaja: valida **explicitamente** que el valor sea un entero valido y lanza un error 400 claro si no lo es (por ejemplo si alguien envia `/products/abc`).

La diferencia clave es **cuando y como** actuan:
- `ParseIntPipe` se ejecuta **antes** de que el valor llegue al metodo del controller, y lanza un `BadRequestException` con un mensaje claro si el valor no es un entero.
- `transform: true` hace la conversion de tipo de forma silenciosa basandose en los tipos de TypeScript, pero si el valor no es convertible, podria pasar `NaN` sin lanzar error.

Por eso se usa `ParseIntPipe` como una validacion explicita y segura para parametros de ruta.

---

## Q3 - Silent strip vs hard rejection

Con solo `whitelist: true` (sin `forbidNonWhitelisted: true`), la respuesta seria **201 Created** y el usuario se crearia exitosamente. El campo `"password"` seria **silenciosamente eliminado** del DTO antes de llegar al service, por lo que nunca se almacena.

El body de respuesta seria algo como:

```json
{
  "id": 3,
  "name": "Maria",
  "email": "m@m.com",
  "age": 20,
  "role": "student"
}
```

Esto es un **problema de seguridad** porque:
- El cliente no recibe ningun error ni advertencia de que el campo fue ignorado.
- Un atacante podria probar enviar campos como `"isAdmin": true` o `"role": "admin"` sin saber que estan siendo descartados, pero si el desarrollador olvida configurar `whitelist` en algun momento, esos campos pasarian directo al servicio.
- Dar un error explicito (con `forbidNonWhitelisted: true`) es mas seguro porque alerta al cliente de que esta enviando datos no esperados.

---

## Q4 - Mutation side-effect

Si, modificar el objeto retornado por `findAll()` **si cambia** los datos almacenados en el service. Esto es porque:

1. `findAll()` retorna `this.products` directamente, que es una referencia al array interno.
2. Los objetos dentro del array son los mismos objetos en memoria. JavaScript no crea copias.
3. Si un caller hace `const products = service.findAll(); products[0].price = 0;`, el precio del primer producto cambia **dentro del servicio tambien**.

Esto pasa porque `Object.assign(product, dto)` en `update()` muta el mismo objeto que esta en el array, lo cual funciona correctamente para update. Pero el problema es que `findAll()` expone las referencias directas.

Para prevenir esto, se deberia retornar una copia:

```typescript
findAll(): Product[] {
  return this.products.map(p => ({ ...p }));
}
```

---

## Q5 - The optional field trap

**Primer caso** (`{"price": -50}`): La validacion **falla** con un 400 Bad Request. Aunque `@IsOptional()` esta presente, el campo `price` **si fue enviado** con valor `-50`. Como el campo esta presente, `@IsPositive()` se ejecuta y rechaza el valor negativo.

**Segundo caso** (`{}`): La validacion **pasa** exitosamente con un 200. Como `price` no fue enviado en el body, `@IsOptional()` indica que se deben **saltar todos los demas validadores** para ese campo.

La regla exacta de `@IsOptional()` es: si el valor de la propiedad es `undefined` o `null`, se ignoran todos los demas decoradores de validacion de ese campo. Pero si el campo **esta presente** (aunque sea con un valor invalido), todos los validadores se ejecutan normalmente. "Optional" significa "puede estar ausente", no "puede tener cualquier valor".

---

## Q6 - ID reuse after deletion

`nextId` es un contador que solo incrementa. Si se elimina el task `#1` y luego se crea un nuevo task, el nuevo task obtiene el id `4` (el valor actual de `nextId`), no `1`. El id `1` nunca se reutiliza.

`findOne(1)` retornaria `NotFoundException` porque el task con id 1 fue eliminado del array. No hay riesgo de retornar el task equivocado.

Si se usara `this.tasks.length + 1`:
1. Estado inicial: 3 tasks (ids 1, 2, 3). `length = 3`.
2. Eliminar task #2: quedan 2 tasks (ids 1, 3). `length = 2`.
3. Crear nuevo task: id seria `2 + 1 = 3`. Pero ya existe un task con id `3`.
4. Ahora hay **dos tasks con id 3**, y `findOne(3)` retornaria el primero que encuentre (`Array.find`), que podria ser el incorrecto.

Por eso `nextId` es la estrategia correcta: garantiza ids unicos que nunca se repiten.

---

## Q7 - Module forgotten

**a)** El servidor **arranca normalmente** sin errores. NestJS no sabe que UsersModule existe porque nunca fue importado, asi que simplemente no registra sus rutas.

**b)** Al enviar `POST /users`, la respuesta es **404 Not Found** con el mensaje `"Cannot POST /users"`. Esto pasa porque el controlador de Users nunca fue registrado en el sistema de rutas de NestJS.

Esto es un **error de runtime** (especificamente, un error en tiempo de request). No es un error de compilacion (TypeScript compila bien) ni un error de startup (NestJS arranca sin problemas). Solo se manifiesta cuando el cliente intenta acceder a una ruta que no existe.

---

## Q8 - Missing 201

En NestJS, un handler decorado con `@Post()` retorna **201 Created** por defecto. Esta es una decision de diseno de NestJS: los metodos POST devuelven 201, mientras que GET, PATCH, DELETE devuelven 200 por defecto.

Por lo tanto, la ausencia de `@HttpCode(201)` **no es funcionalmente incorrecta** para `@Post()` en NestJS, ya que 201 es el comportamiento por defecto.

`@HttpCode()` importa cuando se quiere **cambiar** el codigo por defecto. Por ejemplo, si un POST solo verifica datos pero no crea un recurso, se podria usar `@HttpCode(200)`. Tambien importa si se usa un framework diferente o si se quiere ser explicito en el codigo para mayor legibilidad.

---

## Q9 - Service throws, not returns null

Si el servicio retornara `null`, el codigo se veria asi:

```typescript
// Service
findOne(id: number): Product | null {
  const product = this.products.find((p) => p.id === id);
  return product || null;
}

// Controller
@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number) {
  const product = this.productsService.findOne(id);
  if (!product) {
    throw new NotFoundException(`Product #${id} not found`);
  }
  return product;
}
```

La version que **lanza la excepcion desde el service** es mejor para un codebase en crecimiento porque:

- `findOne` se reutiliza dentro de `update` y `remove`. Si retornara `null`, cada metodo que lo llame tendria que verificar `if (!product)` y lanzar la excepcion. Eso es codigo duplicado.
- Con el throw en el service, la logica de "no encontrado = error" esta centralizada en un solo lugar. Si se cambia el mensaje de error o el tipo de excepcion, solo se modifica en `findOne`.
- Se evita el riesgo de que algun caller olvide verificar el `null`, lo cual causaria errores silenciosos o un `Cannot read property of null` en runtime.
