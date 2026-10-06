#pragma once
#include <optional>
#include <string>

namespace roman {

/// 1..3999 -> canonical Roman numeral; std::nullopt when out of range.
std::optional<std::string> to_roman(int value);

/// Canonical Roman numeral -> value; std::nullopt for anything non-canonical ("IIII", "IC", "").
std::optional<int> from_roman(const std::string& numeral);

}  // namespace roman
