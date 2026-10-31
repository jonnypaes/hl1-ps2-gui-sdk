/* A C model of the observed MIPS argument-forwarding behavior at 0x00108120.
 * This is neither the original source nor a byte-matching recompile.
 * The real function calls 0x001086e8; here we inject that target for tests.
 */
#include <stdint.h>
typedef uint32_t (*ReSeedTarget)(uint32_t, uint32_t, uint32_t, uint32_t);
uint32_t re_00108120_forward_swapped_args(
    uint32_t a0, uint32_t a1, uint32_t a2, uint32_t a3, ReSeedTarget target)
{
    return target(a0, a2, a1, a3);
}
