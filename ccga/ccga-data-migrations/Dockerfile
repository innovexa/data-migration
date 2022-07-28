FROM robbrazier/php:7.1

RUN apk update
RUN apk upgrade

RUN apk add --update nodejs npm
RUN apk add bash

RUN docker-php-ext-install mysqli

RUN mkdir migration
WORKDIR /migration

COPY . /migration
COPY migrate.sh /migration/migrate.sh

RUN cd php && composer install 

RUN ls php/vendor

RUN npm install

ENTRYPOINT ["bash","./migrate.sh"]

