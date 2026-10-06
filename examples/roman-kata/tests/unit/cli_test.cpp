#include "app/cli.h"

#include <gtest/gtest.h>

#include <sstream>

namespace {
struct Result { int code; std::string out, err; };
Result run(std::vector<std::string> args) {
  std::ostringstream out, err;
  int code = roman::cli::run(args, out, err);
  return {code, out.str(), err.str()};
}
}  // namespace

TEST(Cli, KeepsGoingAfterABadArgument) {
  auto r = run({"X", "bogus", "5"});
  EXPECT_EQ(r.code, 2);
  EXPECT_EQ(r.out, "10\nV\n");
  EXPECT_NE(r.err.find("bogus"), std::string::npos);
}

TEST(Cli, LongDigitStringsAreOutOfRangeNotACrash) {
  auto r = run({"123456789012345678901234567890"});
  EXPECT_EQ(r.code, 2);
  EXPECT_NE(r.err.find("out of range"), std::string::npos);
}

TEST(Cli, EmptyArgumentIsInvalidNotACrash) {
  auto r = run({""});
  EXPECT_EQ(r.code, 2);
  EXPECT_NE(r.err.find("not a valid Roman"), std::string::npos);
}
