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
  npmDepsHash = "sha256-pIpM5VJbPsef7wT3CJjv6aqGRwYGTx/F689x/miY6Tg=";
  makeCacheWritable = true; # to work around npm bug
  dontNpmBuild = true;

  meta = {
    description = "Package and documentation registry for Gren applications";
    homepage = "https://packages.gren-lang.org";
    license = pkgs.lib.licenses.bsd3;
    mainProgram = "gren-package-server";
  };
}
