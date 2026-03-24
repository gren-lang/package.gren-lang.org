let
  sources = import ./npins;
  nixpkgs = import sources.nixpkgs { };
  pkgJson = builtins.fromJSON (builtins.readFile ./package.json);
in
{
  pkgs ? nixpkgs,
}:
pkgs.buildNpmPackage {
  pname = "package.gren-lang.org";
  version = pkgJson.version;
  src = ./.;
  npmDepsHash = "sha256-uzUtbbWVqfCPDAZ4C9OHMx0/GQ4sraPkt5P3ZrvQBBg=";
  makeCacheWritable = true; # to work around npm bug
  dontNpmBuild = true;
}
