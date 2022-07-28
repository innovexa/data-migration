#!/usr/bin/env bash

# run the node scripts

for i in `ls node/*.js | sort -n`; do echo $i node $i;  done;
cd php
for i in `ls *.php | sort -n`; do echo $i; php $i;  done;