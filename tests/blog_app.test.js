const { test, expect, beforeEach, describe } = require('@playwright/test')

describe('Blog app', () => {
    beforeEach(async ({ page, request }) => {
        // Empty out the db
        await request.post('/api/testing/reset')
        // Creating a user in the database
        await request.post('/api/users', {
            data: {
                name: 'Matti Luukkainen',
                username: 'mluukkai',
                password: 'salainen'
            }
        })
        await page.goto('/')
    })

    test('Login form is shown', async ({ page }) => {
        await expect(page.getByText('log in to application')).toBeVisible()
        await expect(page.getByTestId('username')).toBeVisible()
        await expect(page.getByTestId('password')).toBeVisible()
        await expect(page.getByRole('button')).toBeVisible()
    })

    describe('Login', () => {
        test('succeeds with correct credentials', async ({ page }) => {
            await page.getByTestId('username').fill('mluukkai')
            await page.getByTestId('password').fill('salainen')
            await page.getByRole('button', { name: 'login' }).click()

            await expect(page.getByText('Matti Luukkainen logged in')).toBeVisible()
        })

        test('fails with wrong credentials', async ({ page }) => {
            await page.getByTestId('username').fill('mluukkais')
            await page.getByTestId('password').fill('salainen')
            await page.getByRole('button', { name: 'login' }).click()

            await expect(page.getByText('Matti Luukkainen logged in')).not.toBeVisible()
        })
    })

    describe('When logged in', () => {
        beforeEach(async ({ page }) => {
            // User logs in
            await page.getByTestId('username').fill('mluukkai')
            await page.getByTestId('password').fill('salainen')
            await page.getByRole('button', { name: 'login' }).click()
        })

        test('a new blog can be created', async ({ page }) => {
            await page.getByRole('button', { name: 'create new blog' }).click()
            await page.getByPlaceholder('Type title here').fill('New Blog')
            await page.getByPlaceholder('Type author here').fill('Matti Luukkainen')
            await page.getByPlaceholder('Type url here').fill('https://www.google.com/')
            await page.getByRole('button', { name: 'create' }).click()

            await expect(page.getByText('New Blog Matti Luukkainen')).toBeVisible()
        })

        describe('and a blog is already created by the logged in user', () => {
            beforeEach(async ({ page }) => {
                // User Matti Luukkainen creates a blog
                await page.getByRole('button', { name: 'create new blog' }).click()
                await page.getByPlaceholder('Type title here').fill('New Blog')
                await page.getByPlaceholder('Type author here').fill('Matti Luukkainen')
                await page.getByPlaceholder('Type url here').fill('https://www.google.com/')
                await page.getByRole('button', { name: 'create' }).click()
            })

            test('the blog can be liked', async ({ page }) => {
                await page.getByRole('button', { name: 'view' }).click()
                await expect(page.getByText('likes: 0')).toBeVisible()
                await page.getByRole('button', { name: 'like' }).click()
                await expect(page.getByText('likes: 1')).toBeVisible()
            })

            test('that the user who created the blog can delete it', async ({ page }) => {
                await page.getByRole('button', { name: 'view' }).click()
                page.on('dialog', dialog => dialog.accept());
                await page.getByRole('button', { name: 'remove' }).click()

                await expect(page.getByText('New Blog Matti Luukkainen')).not.toBeVisible()
            })
        })
    })

    test('That a user who did not create a blog cannot see the button to delete it', async ({ page, request }) => {
        // Creating a separate user in the database
        await request.post('/api/users', {
            data: {
                name: 'Winston Thai',
                username: 'winsthai',
                password: 'passwordtesting1234'
            }
        })

        // Logging in with the new user
        await page.getByTestId('username').fill('winsthai')
        await page.getByTestId('password').fill('passwordtesting1234')
        await page.getByRole('button', { name: 'login' }).click()

        // Creating a new blog
        await page.getByRole('button', { name: 'create new blog' }).click()
        await page.getByPlaceholder('Type title here').fill('New Blog')
        await page.getByPlaceholder('Type author here').fill('Matti Luukkainen')
        await page.getByPlaceholder('Type url here').fill('https://www.google.com/')
        await page.getByRole('button', { name: 'create' }).click()

        // Logging out
        await page.getByRole('button', { name: 'logout' }).click()

        // Logging in with different user and ensuring delete button is not present
        await page.getByTestId('username').fill('mluukkai')
        await page.getByTestId('password').fill('salainen')
        await page.getByRole('button', { name: 'login' }).click()
        await page.getByRole('button', { name: 'view' }).click()

        await expect(page.getByRole('button', { name: 'remove' })).not.toBeVisible()
    }) 

    test('That blogs are listed in order from most liked to least liked', async ({ page, request }) => {
        // Get token from login api
        const response = await request.post('/api/login', {
            data: {
                username: "mluukkai",
                password: "salainen"
            }
        })

        const body = await response.text()
        const token = JSON.parse(body).token

        // Create blog posts
        await request.post('api/blogs', {
            headers: {
                Authorization: `Bearer ${token}`
            },
            data: {
                title: "Hello world third version", 
                author: "Harris Yellow",
                url: "https://www.facebook.com/",
                likes: 2099
            }
        })

        await request.post('api/blogs', {
            headers: {
                Authorization: `Bearer ${token}`
            },
            data: {
                title: "Hello world second version", 
                author: "John Green",
                url: "https://www.google.com/",
                likes: 100
            }
        })

        await request.post('api/blogs', {
            headers: {
                Authorization: `Bearer ${token}`
            },
            data: {
                title: "Hello world first version", 
                author: "Marvin Grey",
                url: "https://www.twitter.com/",
                likes: 99
            }
        })

        // Refresh the page to load new blogs
        await page.goto('/')
        
        // Logging in 
        await page.getByTestId('username').fill('mluukkai')
        await page.getByTestId('password').fill('salainen')
        await page.getByRole('button', { name: 'login' }).click()

        // Check that first blog has highest number of likes - 2099
        await page.getByRole('button', { name: 'view' }).first().click()
        await expect(page.getByText('likes: 2099')).toBeVisible()
        await page.getByRole('button', { name: 'hide' }).click()

        // Check that second blog has second highest number of likes - 100
        await page.getByRole('button', { name: 'view' }).nth(1).click()
        await expect(page.getByText('likes: 100')).toBeVisible()
        await page.getByRole('button', { name: 'hide' }).click()

        // Check that second blog has lowest number of likes - 99
        await page.getByRole('button', { name: 'view' }).nth(2).click()
        await expect(page.getByText('likes: 99')).toBeVisible()
        await page.getByRole('button', { name: 'hide' }).click()
    })
})