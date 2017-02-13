#!/bin/bash

clear

tail -n 10 queried/q*|GREP_COLOR="1;32" grep "^.* > " --color=always|GREP_COLOR="1;35" grep "[^a-zA-Z0-9.,:!'$£()\[\]-]" --color=always
