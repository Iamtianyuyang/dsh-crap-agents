#include <iostream>
#include <string>
#include <vector>

#include "app/cli.h"

int main(int argc, char** argv) {
  return roman::cli::run(std::vector<std::string>(argv + 1, argv + argc), std::cout, std::cerr);
}
