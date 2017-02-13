#!/bin/bash

tail -f queried_length_*|GREP_COLOR="1;34" grep "[^a-zA-Z0-9>,/_ ='*.-"] --color=always
