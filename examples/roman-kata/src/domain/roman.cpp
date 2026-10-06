#include "domain/roman.h"

#include <array>
#include <utility>

namespace roman {
namespace {

constexpr std::array<std::pair<int, const char*>, 13> kTable{{
    {1000, "M"}, {900, "CM"}, {500, "D"}, {400, "CD"}, {100, "C"}, {90, "XC"},
    {50, "L"},   {40, "XL"},  {10, "X"},  {9, "IX"},   {5, "V"},   {4, "IV"}, {1, "I"},
}};

constexpr int kMin = 1;
constexpr int kMax = 3999;

bool in_range(int value) { return value >= kMin && value <= kMax; }

int digit_value(char c) {
  switch (c) {
    case 'I': return 1;
    case 'V': return 5;
    case 'X': return 10;
    case 'L': return 50;
    case 'C': return 100;
    case 'D': return 500;
    case 'M': return 1000;
    default: return 0;
  }
}

// Subtractive notation: when a digit is larger than the previous one, the previous one
// was added but should have been subtracted, so take it back twice.
std::optional<int> parse_additive(const std::string& numeral) {
  int total = 0;
  int prev = 0;
  for (char c : numeral) {
    int cur = digit_value(c);
    if (cur == 0) return std::nullopt;
    total += prev < cur ? cur - 2 * prev : cur;
    prev = cur;
  }
  return total;
}

}  // namespace

std::optional<std::string> to_roman(int value) {
  if (!in_range(value)) return std::nullopt;
  std::string out;
  for (const auto& [arabic, glyph] : kTable) {
    while (value >= arabic) {
      out += glyph;
      value -= arabic;
    }
  }
  return out;
}

std::optional<int> from_roman(const std::string& numeral) {
  auto value = parse_additive(numeral);
  if (!value || !in_range(*value)) return std::nullopt;
  // Only canonical spellings round-trip; rejects IIII, IC, VX, ...
  if (to_roman(*value) != numeral) return std::nullopt;
  return value;
}

}  // namespace roman
