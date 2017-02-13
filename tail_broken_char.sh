#!/bin/bash

tail -f queried_length_*|GREP_COLOR="1;34" grep -E "[^a-zA-Z0-9А-Яа-яЁё>,/_ ='*.-"] --color=always
