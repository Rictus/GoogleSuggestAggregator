#!/bin/bash

# Watch cmd doesn't exist in mac.
while :;
do
  clear
  date
  tail -n 6 queried/queried_length_4|grep -e ">"
  sleep 1
done
