#include "domain/roman.h"

#include <gtest/gtest.h>

using roman::from_roman;
using roman::to_roman;

TEST(ToRoman, ConvertsSubtractivePairs) {
  EXPECT_EQ(to_roman(4), "IV");
  EXPECT_EQ(to_roman(944), "CMXLIV");
  EXPECT_EQ(to_roman(3999), "MMMCMXCIX");
}

TEST(ToRoman, RejectsOutOfRange) {
  EXPECT_EQ(to_roman(0), std::nullopt);
  EXPECT_EQ(to_roman(4000), std::nullopt);
  EXPECT_EQ(to_roman(-1), std::nullopt);
  EXPECT_EQ(to_roman(1), "I");
}

TEST(FromRoman, RoundTripsEveryValue) {
  for (int v = 1; v <= 3999; ++v) {
    auto numeral = to_roman(v);
    ASSERT_TRUE(numeral.has_value());
    EXPECT_EQ(from_roman(*numeral), v) << *numeral;
  }
}

TEST(FromRoman, RejectsNonCanonical) {
  EXPECT_EQ(from_roman(""), std::nullopt);
  EXPECT_EQ(from_roman("IIII"), std::nullopt);
  EXPECT_EQ(from_roman("VX"), std::nullopt);
  EXPECT_EQ(from_roman("MMMM"), std::nullopt);
  EXPECT_EQ(from_roman("iv"), std::nullopt);
}
