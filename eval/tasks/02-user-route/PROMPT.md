# Task: Typed route params

1. `createApp` with empty state.
2. Route `/users/:id` must type `state.params.id` as `string`.
3. Render `<h1>User {id}</h1>`.
4. `app.toString('/users/42')` includes `User 42`.
