# BFF_user — Module overview

[Technical documentation](technical.md) · [Français](../fr/module.md) · [README](../../README.md)

Centralize sign-in, session access and account administration for the Mairie360 interfaces. This BFF adapts Core and supplies the user context shared by other modules.

## Audience and value

Teams developing sign-in, administration and modules that consume a user session.

Business domain: Identity and administration.

## Available capabilities

- Sign-in, first-sign-in password change, forgotten password (reset e-mail, then reset with the e-mailed token, which signs the user in) and logout (no public self-registration: administrators create accounts).
- Session lookup with identity, groups and roles through `/me` and `/session/me`.
- User, role, group, membership and session operations under `/admin`.
- List of the projects left without a group (`/admin/projects-without-group`, read from BFF_Project) for the groups tab.

## Typical workflow

1. The sign-in portal submits credentials to the BFF.
2. The BFF communicates with Core or starts the mandatory password-change flow.
3. Interfaces reuse the session to load context and perform authorized operations.

## Role within Mairie360

Associated repositories: [Administrator_Web_Service](https://github.com/mairie360/Administrator_Web_Service), [Login_Web_Service](https://github.com/mairie360/Login_Web_Service).

This repository contains the BFF server and its contract. Associated web services own the screens; the BFF adapts data and server rules needed by those screens.

## Data and current state

Core API supplies identity, sessions, users, roles and groups: the BFF has no database or Redis access, and every read or write goes through Core API, first sign-in included. The only exception is the list of projects without a group, read from BFF_Project.

## Scope and limitations

Monitoring, backups, application logs and system policy described in administration requirements are not guaranteed by this contract.

## Developing or operating this module

The [technical guide](technical.md) covers architecture, configuration, routes, session handling, persistence, tests and CI/CD. It describes sources of truth and contract synchronization with associated repositories.
