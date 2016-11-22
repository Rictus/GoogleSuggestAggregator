#!/bin/bash

#
# Watch cmd doesn't exist in mac.
while :;
  do
  clear
  date
  wc -l queried/*
  tail -n 3 queried/*
  sleep 1
done
