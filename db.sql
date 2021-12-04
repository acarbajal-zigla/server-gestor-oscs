CREATE TABLE `gestoroscs`.`usertypes` (
    `id` INT NOT NULL,
    `description` VARCHAR(45) NULL,
    UNIQUE INDEX `description_UNIQUE` (`description` ASC) VISIBLE,
    PRIMARY KEY (`id`)
);

CREATE TABLE `gestoroscs`.`users` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(16) NULL,
    `email` VARCHAR(255) NULL,
    `password` VARCHAR(255) NULL,
    `create_time` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    `usertype` INT(3) NULL,
    PRIMARY KEY (`id`)
);

