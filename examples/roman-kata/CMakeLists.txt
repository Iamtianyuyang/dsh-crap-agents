cmake_minimum_required(VERSION 3.21)
project(roman_kata CXX)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Real projects vendor the kit at .gauntlet/; this example uses the copy in this repo.
if(EXISTS "${CMAKE_SOURCE_DIR}/.gauntlet/cmake/Gauntlet.cmake")
  include("${CMAKE_SOURCE_DIR}/.gauntlet/cmake/Gauntlet.cmake")
else()
  include("${CMAKE_SOURCE_DIR}/../../kit/cmake/Gauntlet.cmake")
endif()

add_library(roman_domain src/domain/roman.cpp)
target_include_directories(roman_domain PUBLIC src)

add_library(roman_app src/app/cli.cpp)
target_link_libraries(roman_app PUBLIC roman_domain)

# Humble main: all behaviour lives in roman_app (tested); main only forwards argv.
add_executable(roman src/app/main.cpp)
target_link_libraries(roman PRIVATE roman_app)

include(FetchContent)
set(gtest_force_shared_crt ON CACHE BOOL "" FORCE)
set(INSTALL_GTEST OFF CACHE BOOL "" FORCE)
FetchContent_Declare(googletest URL https://github.com/google/googletest/archive/refs/tags/v1.15.2.tar.gz)
FetchContent_MakeAvailable(googletest)
include(GoogleTest)

add_executable(unit_tests tests/unit/roman_test.cpp tests/unit/cli_test.cpp)
target_link_libraries(unit_tests PRIVATE roman_app GTest::gtest_main)
gtest_discover_tests(unit_tests DISCOVERY_MODE PRE_TEST)

gauntlet_add_acceptance(LINK roman_app
  STEPS_DIR ${CMAKE_SOURCE_DIR}/.gauntlet/acceptance/steps
  GENERATED_DIR ${CMAKE_SOURCE_DIR}/.gauntlet/acceptance/generated)

# Smoke tests of the real executable: main() must hand over every argument, in order.
add_test(NAME cli.forwards_all_arguments COMMAND roman 1 MMXXVI 3999)
set_tests_properties(cli.forwards_all_arguments PROPERTIES PASS_REGULAR_EXPRESSION "^I\r?\n2026\r?\nMMMCMXCIX\r?\n$")
add_test(NAME cli.no_arguments_is_usage_error COMMAND roman)
set_tests_properties(cli.no_arguments_is_usage_error PROPERTIES WILL_FAIL TRUE)
