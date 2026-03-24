let
  sources = import ./npins;
  pkgs = import sources.nixpkgs { };
in
pkgs.mkShellNoCC {
  packages = with pkgs; [
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
