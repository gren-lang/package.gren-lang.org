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
  npmDepsHash = "sha256-PoW/07qqJTzUzJgHJi1CmA9dxn07OKsAIcPgF/MS5wM=";

  strictDeps = true;
  __structuredAttrs = true;

  dontNpmBuild = true;

  buildInputs = [ pkgs.makeBinaryWrapper ];

  fixupPhase = ''
    runHook preFixup

    wrapProgram $out/bin/gren-package-server --suffix PATH : ${pkgs.lib.makeBinPath [ pkgs.git ]}

    runHook postFixup
  '';

  meta = {
    description = "Package and documentation registry for Gren applications";
    homepage = "https://packages.gren-lang.org";
    license = pkgs.lib.licenses.bsd3;
    mainProgram = "gren-package-server";
  };
}
