# BFF_user — Module overview

[Technical documentation](technical.md) · [Français](../fr/module.md) · [README](../../README.md)

Centralize sign-in, session access and account administration for the Mairie360 interfaces. This BFF adapts Core and supplies the user context shared by other modules.

## Audience and value

Teams developing sign-in, administration and modules that consume a user session.

Business domain: Identity and administration.

## Available capabilities

- Sign-in, registration, first-sign-in password change and logout.
- Session lookup with identity, groups and roles through `/me` and `/session/me`.
- User, role, group, membership and session operations under `/bff/admin`.

## Typical workflow

1. The sign-in portal submits credentials to the BFF.
2. The BFF communicates with Core or starts the mandatory password-change flow.
3. Interfaces reuse the session to load context and perform authorized operations.

## Role within Mairie360

Associated repositories: [Administrator_Web_Service](https://github.com/mairie360/Administrator_Web_Service), [Login_Web_Service](https://github.com/mairie360/Login_Web_Service).

This repository contains the BFF server and its contract. Associated web services own the screens; the BFF adapts data and server rules needed by those screens.

## Data and current state

Core supplies identity and session operations. The BFF SQL repositories also read users and roles and perform some password and group mutations. The first-sign-in flow uses PostgreSQL and Redis. Data access is therefore a mixture of HTTP and direct database operations.

## Scope and limitations

Monitoring, backups, application logs and system policy described in administration requirements are not guaranteed by this contract. SQL access requires a compatible schema, including `group_members`; this name differs from `group_users` used in other contracts.

## Developing or operating this module

The [technical guide](technical.md) covers architecture, configuration, routes, session handling, persistence, tests and CI/CD. It describes sources of truth and contract synchronization with associated repositories.
