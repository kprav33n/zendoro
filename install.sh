#!/bin/bash -ex

# Install brew/npm/yarn if they don't exist
command -v brew >/dev/null 2>&1
if [[ $? != 0 ]]; then
    /usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
fi

command -v brew >/dev/null 2>&1
if [[ $? != 0 ]]; then
    brew update
    brew upgrade npm
fi

command -v brew >/dev/null 2>&1
if [[ $? != 0 ]]; then
    npm install -g yarn
    yarn install
fi

rm -rf ./Zendoro-darwin-x64 || true
yarn dist
rm -rf /Applications/Zendoro.app || true
mv ./Zendoro-darwin-x64/Zendoro.app /Applications

