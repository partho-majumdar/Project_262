package com.groupmart;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class GroupMartApplication {

    public static void main(String[] args) {
        SpringApplication.run(GroupMartApplication.class, args);
    }
}
