#pragma once
#include <iosfwd>
#include <string>
#include <vector>

namespace roman::cli {

/// `roman <number|numeral>...` -- converts each argument in the other direction.
/// Returns 0 on success, 2 when any argument is invalid (error printed to err).
int run(const std::vector<std::string>& args, std::ostream& out, std::ostream& err);

}  // namespace roman::cli
