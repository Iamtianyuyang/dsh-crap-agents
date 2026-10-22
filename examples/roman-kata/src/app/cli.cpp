#include "app/cli.h"

#include <cctype>
#include <ostream>

#include "domain/roman.h"

namespace roman::cli {
namespace {

bool all_digits(const std::string& s) {
  if (s.empty()) return false;
  for (char c : s) {
    if (!std::isdigit(static_cast<unsigned char>(c))) return false;
  }
  return true;
}

bool convert(const std::string& arg, std::ostream& out, std::ostream& err) {
  if (all_digits(arg)) {
    auto numeral = arg.size() <= 4 ? to_roman(std::stoi(arg)) : std::nullopt;
    if (!numeral) {
      err << "error: " << arg << " is out of range (1..3999)\n";
      return false;
    }
    out << *numeral << "\n";
    return true;
  }
  auto value = from_roman(arg);
  if (!value) {
    err << "error: '" << arg << "' is not a valid Roman numeral\n";
    return false;
  }
  out << *value << "\n";
  return true;
}

}  // namespace

int run(const std::vector<std::string>& args, std::ostream& out, std::ostream& err) {
  if (args.empty()) {
    err << "usage: roman <number|numeral>...\n";
    return 2;
  }
  bool ok = true;
  for (const auto& a : args) ok = convert(a, out, err) && ok;
  return ok ? 0 : 2;
}

}  // namespace roman::cli
