#!/usr/bin/env bash
set -e

cd /usr/src/app

cat << EOF

○--------------------------------○
| Docker Development Environment |
○--------------------------------○

EOF

# Install dependencies with npm if they are not present. The node_modules
# directory is a mounted volume so it will always be present. Check whether it
# is empty to know if the dependencies should be installed.
if test -z "$(ls -A node_modules)"; then
  echo "⚪ Installing dependencies from scratch with 'npm ci' (this will take a while)..."
  echo
  npm ci
elif test -n "$DOCKER_INSTALL_DEPENDENCIES"; then
  echo "⚪ Installing/updating dependencies with 'npm install' ..."
  echo
  npm install
else
  echo "⚪ Skipping installation of dependencies"
  echo
  echo "> Use 'npm run compose:install' to install/update dependencies,"
  echo "> or set the \$DOCKER_INSTALL_DEPENDENCIES environment variable."
fi

echo
echo "✅ Development setup complete, starting..."
echo

# Run the command provided in the arguments.
exec "$@"
