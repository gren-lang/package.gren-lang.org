let
  sources = import ./npins;
  pkgs = import sources.nixpkgs { };
in
pkgs.mkShellNoCC {
  packages = with pkgs; [
    npins
    nodejs
    nixfmt
    nodePackages.prettier
    go-task
  ];

  shellHook = ''
    echo "Node version: ''$(node --version)"
    task --list
  '';
}
