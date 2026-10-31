#include <assert.h>
#include <stdint.h>
#include <stdio.h>
uint32_t re_00108120_forward_swapped_args(
    uint32_t, uint32_t, uint32_t, uint32_t,
    uint32_t (*)(uint32_t, uint32_t, uint32_t, uint32_t));
static uint32_t observed[4];
static uint32_t spy(uint32_t a, uint32_t b, uint32_t c, uint32_t d)
{
    observed[0]=a; observed[1]=b; observed[2]=c; observed[3]=d;
    return 0xdecafbadU;
}
int main(void)
{
    assert(re_00108120_forward_swapped_args(11,22,33,44,spy)==0xdecafbadU);
    assert(observed[0]==11 && observed[1]==33 &&
           observed[2]==22 && observed[3]==44);
    puts("verified forwarding model passed");
    return 0;
}
