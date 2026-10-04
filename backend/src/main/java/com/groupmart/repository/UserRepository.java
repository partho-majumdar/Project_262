package com.groupmart.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.groupmart.entity.Role;
import com.groupmart.entity.User;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);

    List<User> findByRoleAndEnabledTrue(Role role);

    Boolean existsByEmail(String email);
}
