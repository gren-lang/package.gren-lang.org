# Gren Packages

The server hosting [Gren's packaging site](https://packages.gren-lang.org).

Read the [official announcement](https://gren-lang.org/news/220822_documentation_as_a_first_class_citizen) to learn more.

## Preview docs

When installing this package through npm, you will get a binary called `gren-doc-preview`.

Execute this while standing in a Gren package directory, and a server will be hosted on `http://localhost:3000` (by default) with the documentation of that package, as it will look on the official package site.

This preivew'er currently doesn't do auto-reloading, so you'll need to relaunch the binary every time you make a change to the documentation.

## Configuration

By default, the packaging site will run on port 3000 and the documentation will be stored in an in-memory database. Both of these can be changed using environment variables:

- `GREN_PORT` sets the port the server listen on
- `GREN_PACKAGES_DATABASE` sets a path where a sqlite database containing the documentation will be stored.
